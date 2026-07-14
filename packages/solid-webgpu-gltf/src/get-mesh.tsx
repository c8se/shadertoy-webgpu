import { untrack } from 'solid-js'
import { createBufferFromValue, Mesh } from 'solid-webgpu'
import { getAccessor } from './get-accessor'
import { getMaterial } from './get-material'
import { LoaderContext } from './types'

export const getMesh = async (index: number, context: LoaderContext) => {
  const json = context.json.meshes?.[index]
  if (!json) {
    throw new Error('gltf mesh not found')
  }
  const _accessor = (i: number) => context.withCache(`accessor_${i}`, () => getAccessor(i, context))
  const _material = (i: number) => context.withCache(`material_${i}`, () => getMaterial(i, context))

  return await Promise.all(
    json.primitives.map(async primitive => {
      const draco = primitive.extensions?.['KHR_draco_mesh_compression'] as {
        bufferView: number
        attributes: Record<string, number>
      }
      if (draco) {
        throw new Error('KHR_draco_mesh_compression not supported')
      }
      const attributeKeys = Object.keys(primitive.attributes)

      const createMat = primitive.material !== undefined ? await _material(primitive.material) : undefined

      return () => {
        const ibAc = _accessor(primitive.indices!)
        const indexBuffer =
          primitive.indices !== undefined
            ? {
                buffer: untrack(() =>
                  createBufferFromValue(
                    { usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST },
                    ibAc.bufferData
                  )()
                ),
                BYTES_PER_ELEMENT: ibAc.bufferData.BYTES_PER_ELEMENT
              }
            : undefined
        const vertexBuffers = attributeKeys.map((k, i) => {
          const accessor = _accessor(primitive.attributes[k])
          const buffer = accessor.bufferData
          const vbs = createBufferFromValue({ usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }, buffer)
          return {
            buffer: untrack(() => vbs()),
            layout: {
              arrayStride: accessor.arrayStride,
              attributes: [
                {
                  format: accessor.format,
                  offset: 0,
                  shaderLocation: i
                }
              ]
            },
            name: k,
            type: `vec${accessor.itemSize}<${accessor.itemType}>`
          }
        })

        const mat = createMat?.()

        return (
          <Mesh
            label={json.name ?? `gltf mesh ${index}`}
            geometry={{
              indexBuffer,
              vertexBuffers
            }}
            material={mat?.()}
          ></Mesh>
        )
      }
    })
  )
}
