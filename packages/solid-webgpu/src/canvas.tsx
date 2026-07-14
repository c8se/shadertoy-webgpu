import { Vec3 } from '@rubick24/math'
import { merge, omit, onSettled, type ParentProps } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { createRender } from './create-render'
import { CameraRef } from './types'

const tempVec3 = Vec3.create()

export type CanvasProps = ParentProps &
  JSX.HTMLAttributes<HTMLCanvasElement> & {
    width?: number
    height?: number
    format?: GPUTextureFormat
    autoClear?: boolean
    clearValue?: GPUColor
    sampleCount?: number
    camera?: CameraRef
    ref?: (v: HTMLCanvasElement) => void

    update?: (t: number) => void
    updateSignal?: () => number
  }

export const Canvas = (props: CanvasProps) => {
  const defaultProps = {
    width: 960,
    height: 540,
    format: navigator.gpu.getPreferredCanvasFormat(),
    autoClear: true,
    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
    sampleCount: 4
  }

  const rest = omit(
    props,
    'children',
    'ref',
    'width',
    'height',
    'format',
    'autoClear',
    'clearValue',
    'sampleCount',
    'camera',
    'update',
    'updateSignal'
  )
  const propsWithDefault = merge(defaultProps, props)

  const canvas = (
    <canvas {...rest} width={propsWithDefault.width} height={propsWithDefault.height} />
  ) as HTMLCanvasElement
  onSettled(() => {
    propsWithDefault.ref?.(canvas)
  })

  const context = canvas.getContext('webgpu')!

  createRender(
    () => ({
      camera: propsWithDefault.camera,
      autoClear: propsWithDefault.autoClear,
      clearValue: propsWithDefault.clearValue,
      // shared
      width: propsWithDefault.width,
      height: propsWithDefault.height,
      format: propsWithDefault.format,
      sampleCount: propsWithDefault.sampleCount,
      // render to canvas
      canvas,
      context,

      update: propsWithDefault.update,
      updateSignal: propsWithDefault.updateSignal
    }),
    () => propsWithDefault.children
  )

  return canvas
}
