import { children, createEffect, createMemo, onSettled, untrack } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { GeometryOptions } from './geometry'
import { createRenderPipeline } from './hks'
import { defaultMaterial, MaterialOptions } from './material'
import { createObject3DRef, Object3DProps, wgpuCompRender } from './object3d'
import { $MESH, MeshRef, Object3DComponent } from './types'
import { access } from './utils'

export type MeshProps = Object3DProps<MeshRef> & {
  material?: MaterialOptions
  geometry: GeometryOptions
}

export const Mesh = (props: MeshProps) => {
  const ch = children(() => props.children)
  let drawImpl: MeshRef['draw'] = () => {}
  const { store, comp } = createObject3DRef<MeshRef>(props, ch, {
    [$MESH]: true,
    draw: passEncoder => drawImpl(passEncoder)
  })
  const id = comp.id
  onSettled(() => {
    props.ref?.(store)
  })

  createEffect(
    () => store.scene()?.[1],
    setScene => {
      if (!setScene) return
      setScene(scene => {
        scene.renderList.push(id)
      })
      return () =>
        setScene(scene => {
          const index = scene.renderList.indexOf(id)
          if (index !== -1) scene.renderList.splice(index, 1)
        })
    }
  )

  const material = () => props.material ?? defaultMaterial

  const pipelineOps = createMemo(() => ({
    shaderCode: material().shaderCode,
    bindGroupLayout: material().bindGroupLayout,
    vertexBuffers: props.geometry.vertexBuffers,
    format: material().format,
    vertexEntryPoint: material().vertexEntryPoint,
    fragmentEntryPoint: material().fragmentEntryPoint,
    primitive: props.geometry.primitive,
    depthStencil: props.geometry.depthStencil,
    multisample: store.scene()?.[0].sampleCount ? { count: store.scene()?.[0].sampleCount } : undefined
  }))
  const pipeline = createRenderPipeline(pipelineOps)

  const _instanceCount = () => props.geometry.instanceCount ?? 1
  const _drawRange = () => props.geometry.drawRange ?? { start: 0, count: Infinity }

  drawImpl = (passEncoder: GPURenderPassEncoder) => {
    // GPU uniform updates are imperative snapshots. Running them at draw time
    // avoids reading async material state from a tracked effect before an
    // enclosing Loading boundary has revealed the mesh.
    untrack(() => material().update?.(store))

    const _pipeline = pipeline()
    if (!_pipeline) {
      return
    }
    passEncoder.setPipeline(_pipeline)

    const indexBuffer = props.geometry.indexBuffer
    const vertexBuffers = props.geometry.vertexBuffers

    const bindGroup = material().bindGroup
    const instanceCount = _instanceCount()
    const drawRange = _drawRange()

    if (indexBuffer) {
      passEncoder.setIndexBuffer(indexBuffer.buffer, `uint${indexBuffer.BYTES_PER_ELEMENT * 8}` as GPUIndexFormat)
    }
    vertexBuffers.forEach((v, i) => {
      const buffer = access(v.buffer)
      if (!buffer) {
        return
      }
      passEncoder.setVertexBuffer(i, buffer)
    })

    const _bindGroup = access(bindGroup)
    if (_bindGroup) {
      passEncoder.setBindGroup(0, _bindGroup)
    }

    const positionAttr = vertexBuffers[0]

    // Alternate drawing for indexed and non-indexed children
    if (indexBuffer) {
      const count = Math.min(drawRange.count, indexBuffer.buffer.size / indexBuffer.BYTES_PER_ELEMENT)
      passEncoder.drawIndexed(count, instanceCount, drawRange.start ?? 0)
    } else if (positionAttr) {
      const count = Math.min(
        drawRange.count,
        access(positionAttr.buffer).size / access(positionAttr.layout).arrayStride
      )
      passEncoder.draw(count, instanceCount, drawRange.start ?? 0)
    } else {
      passEncoder.draw(3, instanceCount)
    }
  }

  return {
    ...comp,
    render: () => {
      comp.render()
      return wgpuCompRender(ch)
    }
  } satisfies Object3DComponent as unknown as JSX.Element
}
