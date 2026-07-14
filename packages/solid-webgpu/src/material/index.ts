import { Vec3, Vec3Like } from '@rubick24/math'
import { Accessor, createEffect, createMemo, createRoot } from 'solid-js'
import {
  createBindGroup,
  createBindGroupEntries,
  createBindGroupLayout,
  createTextureFromImage,
  createUniformBufferBase,
  createUniformBufferPunctualLights,
  device
} from '../hks'
import { MaybeAccessor, MeshRef } from '../types'
import { access, imageBitmapFromImageUrl, setBitOfValue, white1pxBase64 } from '../utils'
import pbrShaderCode from './default-pbr.wgsl?raw'
import unlitShaderCode from './unlit.wgsl?raw'

export type MaterialOptions = {
  shaderCode: string
  bindGroupLayout: GPUBindGroupLayout
  bindGroup: GPUBindGroup

  update?: (ref: MeshRef) => void

  format?: GPUTextureFormat
  vertexEntryPoint?: string
  fragmentEntryPoint?: string
}
export const createMaterial = (
  shaderCode: MaybeAccessor<string>,
  uniforms: MaybeAccessor<(GPUTexture | GPUSampler | GPUBuffer)[]>,
  update?: (ref: MeshRef) => void
): Accessor<MaterialOptions> => {
  const bindGroupLayout = createBindGroupLayout(uniforms)
  const bindGroupEntries = createBindGroupEntries(uniforms)
  const bindGroup = createBindGroup(() => ({
    layout: bindGroupLayout(),
    entries: bindGroupEntries()
  }))

  return createMemo(() => ({
    bindGroupLayout: bindGroupLayout(),
    bindGroup: bindGroup(),
    shaderCode: access(shaderCode),
    update
  }))
}
export const createUnlitMaterial = (
  options?: MaybeAccessor<{
    albedo?: Vec3Like
    albedoTexture?: GPUTexture
    albedoTextureSource?: ImageBitmap
  }>
): Accessor<MaterialOptions> => {
  const { buffer: base, update: updateBase } = createUniformBufferBase()

  const albedoTexture = () => access(options ?? {}).albedoTexture
  const albedoTextureSource = () => access(options ?? {}).albedoTextureSource

  // update albedo & texture flag
  const bufferValue = new ArrayBuffer(16)
  const albedo = new Vec3(bufferValue)
  const buffer = device.createBuffer({
    size: bufferValue.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  })
  device.queue.writeBuffer(buffer, 0, bufferValue)
  createEffect(
    () => ({
      albedo: access(options ?? {}).albedo ?? ([0, 0.5, 1] as Vec3Like),
      hasTexture: !!(albedoTexture() || albedoTextureSource())
    }),
    values => {
      albedo.copy(values.albedo)
      const flag = new Uint32Array(bufferValue, 12, 1)
      flag[0] = setBitOfValue(flag[0], 0, values.hasTexture)
      device.queue.writeBuffer(buffer, 0, bufferValue)
    }
  )

  const texture = createMemo(() => {
    const _albedoTextureSource = albedoTextureSource()
    const _albedoTexture = albedoTexture()
    if (_albedoTexture) {
      return _albedoTexture
    } else if (_albedoTextureSource) {
      return createTextureFromImage({ format: 'rgba8unorm' }, _albedoTextureSource)()
    } else {
      return defaultTexture
    }
  })

  const sampler = device.createSampler()

  const uniforms = () => [base, buffer, texture(), sampler]

  return createMaterial(unlitShaderCode, uniforms, updateBase)
}

export const createPBRMaterial = (
  options?: MaybeAccessor<{
    albedo?: Vec3Like
    metallic?: number
    roughness?: number
    occlusion?: number
    albedoTexture?: GPUTexture
    albedoTextureSource?: ImageBitmap
    occlusionRoughnessMetallicTexture?: GPUTexture
    occlusionRoughnessMetallicTextureSource?: ImageBitmap
  }>
) => {
  const _pbrBuffer = new ArrayBuffer(32)
  const buffer = device.createBuffer({
    size: _pbrBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  })

  createEffect(
    () => access(options),
    ops => {
      new Vec3(_pbrBuffer).copy(ops?.albedo ?? Vec3.fromValues(1, 1, 1))
      const pbrParamsValue = new Float32Array(_pbrBuffer, 12, 3)
      pbrParamsValue[0] = ops?.metallic ?? 0
      pbrParamsValue[1] = ops?.roughness ?? 0.5
      pbrParamsValue[2] = ops?.occlusion ?? 1.0
      const pbrFlag = new Uint32Array(_pbrBuffer, 24, 1)
      pbrFlag[0] = setBitOfValue(pbrFlag[0], 0, !!(ops?.albedoTexture || ops?.albedoTextureSource))
      pbrFlag[0] = setBitOfValue(
        pbrFlag[0],
        1,
        !!(ops?.occlusionRoughnessMetallicTexture || ops?.occlusionRoughnessMetallicTextureSource)
      )

      device.queue.writeBuffer(buffer, 0, _pbrBuffer)
    }
  )

  const { buffer: base, update: updateBase } = createUniformBufferBase()
  const { buffer: punctualLights, update: updatePunctualLights } = createUniformBufferPunctualLights()

  const albedoTexture = createMemo(() => {
    const ops = access(options ?? {})
    const _albedoTextureSource = ops.albedoTextureSource
    const _albedoTexture = ops.albedoTexture
    if (_albedoTexture) {
      return _albedoTexture
    } else if (_albedoTextureSource) {
      return createTextureFromImage({ format: 'rgba8unorm' }, _albedoTextureSource)()
    } else {
      return defaultTexture
    }
  })

  const ormTexture = createMemo(() => {
    const ops = access(options ?? {})
    const _ormTextureSource = ops.occlusionRoughnessMetallicTextureSource
    const _ormTexture = ops.occlusionRoughnessMetallicTexture
    if (_ormTexture) {
      return _ormTexture
    } else if (_ormTextureSource) {
      return createTextureFromImage({ format: 'rgba8unorm' }, _ormTextureSource)()
    } else {
      return defaultTexture
    }
  })

  const sampler = device.createSampler()

  const uniforms = () => [base, buffer, albedoTexture(), ormTexture(), sampler, punctualLights]

  return createMaterial(pbrShaderCode, uniforms, v => {
    updateBase(v)
    updatePunctualLights(v)
  })
}

const defaultBitmap = await imageBitmapFromImageUrl(white1pxBase64)
export let defaultTexture: ReturnType<ReturnType<typeof createTextureFromImage>>
export let defaultMaterial: ReturnType<ReturnType<typeof createUnlitMaterial>>
createRoot(() => {
  defaultTexture = createTextureFromImage({ format: 'rgba8unorm' }, defaultBitmap)()
  defaultMaterial = createUnlitMaterial({ albedo: [0.5, 0.5, 0.5] })()
})
