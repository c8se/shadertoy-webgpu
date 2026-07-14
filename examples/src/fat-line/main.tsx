import { createSignal } from 'solid-js'
import { render } from '@solidjs/web'
import {
  Canvas,
  createMaterial,
  createOrbitControl,
  createUniformBufferBase,
  device,
  GeometryOptions,
  Mesh,
  PerspectiveCamera,
  Vec3,
  Vec3Like,
  type CameraRef
} from 'solid-webgpu'
import shaderCode from './shader.wgsl?raw'

const formLineVertices = (options: { points: Vec3Like[]; lineWidth: number; segments: number }) => {
  const { points, segments } = options
  const vertices: number[][] = []
  const indices: number[] = []
  let vertexCount = 0

  if (points.length < 2) return { vertices, indices }

  // 处理每个线段
  for (let i = 0; i < points.length - 1; i++) {
    const pointA = points[i]
    const pointB = points[i + 1]

    // 计算当前线段方向
    const direction = Vec3.subtract(Vec3.create(), pointB, pointA)
    direction.normalize()

    // 1. 添加线段主体
    const segmentStart = vertexCount
    vertices.push(
      [...pointA, ...direction, -1.0, 0, 0.0],
      [...pointA, ...direction, 1.0, 0, 0.0],
      [...pointB, ...direction, -1.0, 0, 0.0],
      [...pointB, ...direction, 1.0, 0, 0.0]
    )
    indices.push(segmentStart, segmentStart + 1, segmentStart + 2, segmentStart + 2, segmentStart + 1, segmentStart + 3)
    vertexCount += 4

    // 2. 处理起点（仅第一个点）
    if (i === 0) {
      const jointCenter = vertexCount
      vertices.push([...pointA, ...direction, 0.0, 1, 0.0]) // 端点中心
      vertexCount++

      for (let j = 0; j <= segments; j++) {
        const angle = (2 * Math.PI * j) / segments // 0 到 π
        vertices.push([...pointA, ...direction, 1.0, 1, angle])

        if (j > 0) {
          indices.push(jointCenter, vertexCount - 1, vertexCount)
        }
        vertexCount++
      }
    }

    // 3. 处理关节
    const jointCenter = vertexCount
    vertices.push([...pointB, ...direction, 0.0, 1, 0.0])
    vertexCount++

    for (let j = 0; j <= segments; j++) {
      const angle = (2 * Math.PI * j) / segments // 0 到 2π
      vertices.push([...pointB, ...direction, 1.0, 1, angle])

      if (j > 0) {
        indices.push(jointCenter, vertexCount, vertexCount - 1)
      }
      vertexCount++
    }
  }

  return { vertices, indices }
}
const createLineGeometry = (options: { vertices: number[][]; indices: number[] }) => {
  const { vertices, indices } = options
  const sizePerVertex = 9 // 位置(3) + 当前方向(3) + 侧边(1) + 端点类型(1) + 角度(1)

  const b = new ArrayBuffer(vertices.length * sizePerVertex * Float32Array.BYTES_PER_ELEMENT)
  const f32arr = new Float32Array(b)
  const i32arr = new Uint32Array(b)
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i]
    f32arr.set(v, i * sizePerVertex)
    i32arr[i * sizePerVertex + 7] = v[7] // isEndpoint
  }

  const vertexBuffer = device.createBuffer({
    size: b.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  })
  device.queue.writeBuffer(vertexBuffer, 0, b)

  const indexVals = new Uint32Array(indices)
  const indexBuffer = device.createBuffer({
    size: indexVals.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
  })
  device.queue.writeBuffer(indexBuffer, 0, indexVals)

  const geo: GeometryOptions = {
    primitive: {
      topology: 'triangle-list',
      cullMode: 'none'
    },
    indexBuffer: {
      buffer: indexBuffer,
      BYTES_PER_ELEMENT: Uint32Array.BYTES_PER_ELEMENT
    },
    vertexBuffers: [
      {
        buffer: vertexBuffer,
        layout: {
          stepMode: 'vertex',
          arrayStride: sizePerVertex * Float32Array.BYTES_PER_ELEMENT,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3'
            }, // POSITION
            {
              shaderLocation: 1,
              offset: 12,
              format: 'float32x3'
            }, // TANGENT
            {
              shaderLocation: 2,
              offset: 24,
              format: 'float32'
            }, // SIDE
            {
              shaderLocation: 3,
              offset: 28,
              format: 'uint32'
            }, // IS_ENDPOINT (0=线段, 1=起点, 2=终点, 3=关节)
            {
              shaderLocation: 4,
              offset: 32,
              format: 'float32'
            } // ANGLE
          ]
        }
      }
    ]
  }
  return geo
}

const App = () => {
  const [camera, setCamera] = createSignal<CameraRef>()
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>()

  createOrbitControl(canvas, camera)

  const vertices = formLineVertices({
    points: [
      [-1, -1, -1],
      [1, -1, -1],
      [1, -1, 1],
      [-1, -1, 1],
      [-1, 1, 1],
      [-1, 1, -1],
      [1, 1, -1],
      [1, 1, 1]
    ],
    lineWidth: 0.4,
    segments: 16
  })
  const geo = createLineGeometry(vertices)
  const { buffer: base, update: updateBase } = createUniformBufferBase()
  const mat = createMaterial(shaderCode, [base], updateBase)

  return (
    <Canvas camera={camera()} ref={setCanvas}>
      <PerspectiveCamera label="main_camera" ref={setCamera} position={[0, 0, 5]} aspect={16 / 9} />

      <Mesh geometry={geo} material={mat()} />
    </Canvas>
  )
}

render(() => <App />, document.getElementById('app')!)
