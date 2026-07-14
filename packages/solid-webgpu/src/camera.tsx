import { DEG2RAD, Mat4, Quat, Vec3 } from '@rubick24/math'
import { children, createEffect, createSignal, merge, omit, onSettled, untrack } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { createObject3DRef, Object3DProps, wgpuCompRender } from './object3d'
import { $CAMERA, CameraExtra, CameraRef, Object3DComponent } from './types'

export type CameraProps = Object3DProps<CameraRef>

const tempM = Mat4.create()

export const lookAt = (outQuat: Quat, position: Vec3, up: Vec3, target: Vec3) => {
  Mat4.targetTo(tempM, position, target, up)
  Mat4.getRotation(outQuat, tempM)
  return outQuat
}

export const Camera = (props: CameraProps) => {
  const ch = children(() => props.children)

  const p = createSignal(new Mat4(), { equals: false })
  const v = createSignal(new Mat4(), { equals: false })
  const pv = createSignal(new Mat4(), { equals: false })
  const cameraExt = {
    [$CAMERA]: true,
    projectionMatrix: p[0],
    setProjectionMatrix: p[1],
    viewMatrix: v[0],
    setViewMatrix: v[1],
    projectionViewMatrix: pv[0],
    setProjectionViewMatrix: pv[1]
  } satisfies CameraExtra
  const { store, comp } = createObject3DRef<CameraRef>(props, ch, cameraExt)

  onSettled(() => {
    props.ref?.(store)
  })

  createEffect(
    () => store.matrix(),
    matrix => {
      untrack(() => {
        store.setViewMatrix(m => {
          m.copy(matrix).invert()
          return m
        })
      })
    }
  )

  createEffect(
    () => [store.projectionMatrix(), store.viewMatrix()] as const,
    ([projection, view]) => {
      untrack(() => {
        store.setProjectionViewMatrix(m => {
          m.copy(projection).multiply(view)
          return m
        })
      })
    }
  )

  return {
    ...comp,
    render: () => wgpuCompRender(ch)
  } satisfies Object3DComponent as unknown as JSX.Element
}

export type PerspectiveCameraProps = CameraProps & {
  fov?: number
  aspect?: number
  near?: number
  far?: number
}
export const PerspectiveCamera = (props: PerspectiveCameraProps) => {
  const others = omit(props, 'ref', 'fov', 'aspect', 'near', 'far')

  const local = merge(
    {
      fov: 75 * DEG2RAD,
      aspect: 1,
      near: 0.1,
      far: 1000
    },
    props
  )

  const [cameraRef, setCameraRef] = createSignal<CameraRef>()

  createEffect(
    () => ({
      camera: cameraRef(),
      fov: local.fov,
      aspect: local.aspect,
      near: local.near,
      far: local.far
    }),
    values => {
      untrack(() => {
        values.camera?.setProjectionMatrix(m => {
          Mat4.perspectiveZO(m, values.fov, values.aspect, values.near, values.far)
          return m
        })
      })
    }
  )

  return (
    <Camera
      {...others}
      ref={v => {
        setCameraRef(v)
        local.ref?.(v)
      }}
    />
  )
}

export type OrthographicCameraProps = CameraProps & {
  near?: number
  far?: number
  left?: number
  right?: number
  bottom?: number
  top?: number
}
export const OrthographicCamera = (props: OrthographicCameraProps) => {
  const others = omit(props, 'ref', 'near', 'far', 'left', 'right', 'bottom', 'top')

  const local = merge(
    {
      near: 0.1,
      far: 1000,
      left: -1,
      right: 1,
      bottom: -1,
      top: 1
    },
    props
  )

  const [cameraRef, setCameraRef] = createSignal<CameraRef>()

  createEffect(
    () => ({
      camera: cameraRef(),
      left: local.left,
      right: local.right,
      bottom: local.bottom,
      top: local.top,
      near: local.near,
      far: local.far
    }),
    values => {
      untrack(() => {
        values.camera?.setProjectionMatrix(m => {
          Mat4.orthoZO(m, values.left, values.right, values.bottom, values.top, values.near, values.far)
          return m
        })
      })
    }
  )

  return (
    <Camera
      {...others}
      ref={v => {
        setCameraRef(v)
        local.ref?.(v)
      }}
    />
  )
}
