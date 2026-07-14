import type { Mat4, Quat, Vec3 } from '@rubick24/math'
import type { Accessor, Setter, StoreSetter } from 'solid-js'
import type { JSX } from '@solidjs/web'

export type Optional<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>

export type TypedArrayConstructor =
  | Int8ArrayConstructor
  | Uint8ArrayConstructor
  | Uint8ClampedArrayConstructor
  | Int16ArrayConstructor
  | Uint16ArrayConstructor
  | Int32ArrayConstructor
  | Uint32ArrayConstructor
  | Float32ArrayConstructor

export type TypedArray = InstanceType<TypedArrayConstructor>

// | HTMLVideoElement
export type ImageRepresentation =
  | ImageBitmap
  | ImageData
  | HTMLImageElement
  | VideoFrame
  | HTMLCanvasElement
  | OffscreenCanvas

// export type ExternalTexture ={
//   type: 'externalTexture'
//   descriptor: GPUTextureDescriptor
//   video?: HTMLVideoElement
// }

export type MaybeAccessor<T> = T | Accessor<T>
export type MaybeAccessorValue<T extends MaybeAccessor<unknown>> = T extends () => any ? ReturnType<T> : T

export type StoreContext<T> = [T, StoreSetter<T>]

export const $WGPU_COMPONENT = Symbol('solid-webgpu component')
export type WgpuComponent = {
  [$WGPU_COMPONENT]: true
  id: string
  render: () => JSX.Element
  setSceneCtx: Setter<StoreContext<SceneContext> | undefined>
}
export type NodeRef = {
  [$WGPU_COMPONENT]: true
  id: string
  label: string

  scene: Accessor<StoreContext<SceneContext> | undefined>
}
export type NodeProps<T = NodeRef> = {
  label?: string
  ref?: (v: T) => void
  children?: JSX.Element
}

export const isWgpuComponent = (value: unknown): value is Object3DComponent => {
  return !!value && typeof value === 'object' && $WGPU_COMPONENT in value
}

export const $OBJECT3D = Symbol('Object3D')
export type Object3DExtra = {
  [$OBJECT3D]: true
  matrix: Accessor<Mat4>
  setMatrix: Setter<Mat4>
  position: Accessor<Vec3>
  setPosition: Setter<Vec3>
  quaternion: Accessor<Quat>
  setQuaternion: Setter<Quat>
  scale: Accessor<Vec3>
  setScale: Setter<Vec3>
  up: Accessor<Vec3>
  setUp: Setter<Vec3>
}
export type Object3DRef = NodeRef & Object3DExtra
export type Object3DComponent = WgpuComponent & {
  [$OBJECT3D]: true
  setParentCtx: Setter<Pick<Object3DRef, 'matrix'> | undefined>
}
export const isObject3DComponent = (value: unknown): value is Object3DComponent => {
  return isWgpuComponent(value) && $OBJECT3D in value
}

export type CameraRef = Object3DRef & CameraExtra
export const $CAMERA = Symbol('Camera')
export type CameraExtra = {
  [$CAMERA]: true
  projectionMatrix: Accessor<Mat4>
  setProjectionMatrix: Setter<Mat4>
  viewMatrix: Accessor<Mat4>
  setViewMatrix: Setter<Mat4>
  projectionViewMatrix: Accessor<Mat4>
  setProjectionViewMatrix: Setter<Mat4>
}

export type PunctualLightRef = Object3DRef & PunctualLightExtra
export const $PUNCTUAL_LIGHT = Symbol('Camera')
export type PunctualLightExtra = {
  [$PUNCTUAL_LIGHT]: true
  color: Accessor<Vec3>
  setColor: Setter<Vec3>
  intensity: number
  range?: number
  lightType: 'directional' | 'point' | 'spot'
  innerConeAngle: number
  outerConeAngle: number
}

export type MeshRef = Object3DRef & MeshExtra
export const $MESH = Symbol('Mesh')
export type MeshExtra = {
  [$MESH]: true
  draw: (passEncoder: GPURenderPassEncoder) => void
}

export type SceneContext = {
  nodes: Record<string, NodeRef & Record<string, unknown>>

  // shared
  width: number
  height: number
  format: GPUTextureFormat
  autoClear: boolean
  clearValue: GPUColor
  sampleCount: number

  // render to texture
  texture?: GPUTexture

  // render to canvas
  canvas?: HTMLCanvasElement
  context?: GPUCanvasContext

  msaaTexture?: GPUTexture
  msaaTextureView?: GPUTextureView
  depthTexture?: GPUTexture
  depthTextureView?: GPUTextureView

  renderList: string[]
  renderOrder: string[]
  lightList: string[]
  currentCamera?: string

  // user
  update?: (t: number) => void
}
