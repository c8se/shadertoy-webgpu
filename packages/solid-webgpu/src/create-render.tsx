import { Vec3 } from '@rubick24/math'
import { children, createEffect, createStore, For, snapshot, untrack } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { device } from './hks'
import { CameraRef, isWgpuComponent, MaybeAccessor, MeshRef, SceneContext } from './types'
import { access } from './utils'

const tempVec3 = Vec3.create()
export const createRender = (
  options: MaybeAccessor<{
    camera?: CameraRef
    autoClear?: boolean
    clearValue?: GPUColor

    // render to texture
    texture?: GPUTexture
    updateSignal?: () => number

    // render to canvas
    canvas?: HTMLCanvasElement
    context?: GPUCanvasContext

    // shared
    width?: number
    height?: number
    format?: GPUTextureFormat
    sampleCount?: number

    // user
    update?: (t: number) => void
  }>,
  ch: () => JSX.Element
) => {
  const defaultOptions = {
    width: 960,
    height: 540,
    format: navigator.gpu.getPreferredCanvasFormat(),
    autoClear: true,
    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
    sampleCount: 4
  }

  const [scene, setScene] = createStore<SceneContext>({
    ...defaultOptions,
    nodes: {},
    renderList: [],
    renderOrder: [],
    lightList: []
  })
  createEffect(
    () => {
      const opts = access(options)
      return { opts, cameraId: opts.camera?.id }
    },
    ({ opts, cameraId }) =>
      setScene(scene => {
        scene.width = opts.texture?.width ?? opts.width ?? scene.width
        scene.height = opts.texture?.height ?? opts.height ?? scene.height
        scene.format = opts.texture?.format ?? opts.format ?? scene.format
        scene.sampleCount = opts.sampleCount ?? scene.sampleCount
        scene.autoClear = opts.autoClear ?? scene.autoClear
        scene.clearValue = opts.clearValue ?? scene.clearValue
        scene.currentCamera = cameraId ?? scene.currentCamera
        scene.texture = opts.texture ?? scene.texture
        scene.canvas = opts.canvas ?? scene.canvas
        scene.context = opts.context ?? scene.context
        scene.update = opts.update ?? scene.update
      })
  )

  /**
   * resize swapchain
   */
  createEffect(
    () => {
      // Track the store field, but pass the raw WebIDL object to WebGPU.
      const context = scene.context ? snapshot(scene).context : undefined
      return {
        context,
        format: scene.format,
        width: scene.width,
        height: scene.height,
        sampleCount: scene.sampleCount
      }
    },
    ({ context, format, width, height, sampleCount }) => {
      if (context) {
        context.configure({
          device,
          format,
          alphaMode: 'premultiplied'
        })
      }

      const size = [width, height]
      const usage = GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
      const msaaTexture = device.createTexture({
        format,
        size,
        usage,
        sampleCount,
        label: 'msaaTexture'
      })
      const depthTexture = device.createTexture({
        format: 'depth24plus-stencil8',
        size,
        usage,
        sampleCount,
        label: 'depthTexture'
      })

      setScene(scene => {
        scene.msaaTexture = msaaTexture
        scene.msaaTextureView = msaaTexture.createView({ label: 'msaaTextureView' })
        scene.depthTexture = depthTexture
        scene.depthTextureView = depthTexture.createView({ label: 'depthTextureView' })
      })

      return () => {
        msaaTexture.destroy()
        depthTexture.destroy()
      }
    }
  )

  /**
   * update render order
   */
  createEffect(
    () => {
      if (!scene.currentCamera) return
      const camera = scene.nodes[scene.currentCamera] as CameraRef
      if (!camera) return
      const projectionViewMatrix = camera.projectionViewMatrix()

      return scene.renderList
        .map(id => {
          const v = scene.nodes[id] as MeshRef
          return {
            m: v.matrix(),
            id: v.id
          }
        })
        .sort((a, b) => {
          let res = 0
          // TODO: handle depthTest disabled
          const am = a.m
          const bm = b.m

          Vec3.set(tempVec3, am[12], am[13], am[14])
          Vec3.transformMat4(tempVec3, tempVec3, projectionViewMatrix)
          const tempZ = tempVec3.z
          Vec3.set(tempVec3, bm[12], bm[13], bm[14])
          Vec3.transformMat4(tempVec3, tempVec3, projectionViewMatrix)
          res = res || tempZ - tempVec3.z
          return res
        })
        .map(v => v.id)
    },
    renderOrder => {
      if (!renderOrder) return
      setScene(scene => {
        scene.renderOrder = renderOrder
      })
    }
  )

  // render function
  const renderFn = () => {
    const currentScene = snapshot(scene)
    const { msaaTextureView, depthTextureView, context, renderOrder } = currentScene
    if (!msaaTextureView || !depthTextureView) {
      return
    }

    const resolveTarget = currentScene.texture?.createView() ?? context?.getCurrentTexture().createView()
    const loadOp: GPULoadOp = currentScene.autoClear ? 'clear' : 'load'
    const storeOp: GPUStoreOp = 'store'
    const commandEncoder = device.createCommandEncoder()

    const direct = context && currentScene.sampleCount === 1
    const colorAttachment: GPURenderPassColorAttachment = {
      view: direct ? resolveTarget! : msaaTextureView,
      resolveTarget: direct ? undefined : resolveTarget,
      loadOp,
      storeOp,
      clearValue: currentScene.clearValue
    }

    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [colorAttachment],
      depthStencilAttachment: {
        view: depthTextureView,
        depthClearValue: 1,
        depthLoadOp: loadOp,
        depthStoreOp: storeOp,
        stencilClearValue: 0,
        stencilLoadOp: loadOp,
        stencilStoreOp: storeOp
      }
    })
    passEncoder.setViewport(0, 0, currentScene.width, currentScene.height, 0, 1)
    for (const id of renderOrder) {
      const mesh = currentScene.nodes[id] as MeshRef
      mesh.draw(passEncoder)
    }

    passEncoder.end()
    device.queue.submit([commandEncoder.finish()])
  }

  let timeout = NaN
  createEffect(
    () => {
      // Explicitly list all dependencies that should trigger a re-render.
      const deps = {
        renderOrder: scene.renderOrder,
        width: scene.width,
        height: scene.height,
        autoClear: scene.autoClear,
        clearValue: scene.clearValue,
        texture: scene.texture,
        sampleCount: scene.sampleCount
      }
      access(options).updateSignal?.()
      return deps
    },
    () => {
      timeout = requestAnimationFrame(t => {
        untrack(() => {
          snapshot(scene).update?.(t)
          renderFn()
        })
      })

      return () => {
        if (timeout) cancelAnimationFrame(timeout)
      }
    }
  )

  const c = children(ch)

  const comp = (
    <For each={c.toArray()}>
      {child => {
        if (isWgpuComponent(child)) {
          child.setSceneCtx([scene, setScene])
          return untrack(() => child.render())
        }
        return child
      }}
    </For>
  )

  return [scene, setScene, comp] as const
}
