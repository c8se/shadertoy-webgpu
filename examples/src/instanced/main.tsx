import { createSignal } from 'solid-js'
import { render } from '@solidjs/web'
import {
  Canvas,
  createMaterial,
  createOrbitControl,
  createPlaneGeometry,
  createUniformBufferBase,
  device,
  Mesh,
  PerspectiveCamera,
  type CameraRef
} from 'solid-webgpu'

const App = () => {
  const [camera, setCamera] = createSignal<CameraRef>()
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>()

  createOrbitControl(canvas, camera)

  const planeGeo = createPlaneGeometry()

  const instanceVal = new Float32Array(3 * 1000).fill(0)
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      for (let k = 0; k < 10; k++) {
        instanceVal.set([i * 3 - 15, j * 3 - 15, 15 - k * 3], (i * 10 * 10 + j * 10 + k) * 3)
      }
    }
  }
  const instanceBuffer = device.createBuffer({
    size: instanceVal.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  })
  device.queue.writeBuffer(instanceBuffer, 0, instanceVal)

  planeGeo.instanceCount = 1000
  planeGeo.vertexBuffers.push({
    buffer: instanceBuffer,
    layout: {
      arrayStride: 12, // 3 * 4 bytes
      stepMode: 'instance', // Key for instancing
      attributes: [
        { format: 'float32x3', offset: 0, shaderLocation: 4 } // instance position
      ]
    }
  })

  const { buffer: base, update: updateBase } = createUniformBufferBase()
  const mat = createMaterial(
    `
struct VertexInput {
    @location(0) POSITION: vec3<f32>,
    @location(1) NORMAL: vec3<f32>,
    @location(2) TANGENT: vec4<f32>,
    @location(3) TEXCOORD_0: vec2<f32>,
    @location(4) INSTANCE_POSITION: vec3<f32>
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

struct BaseUniforms {
    model: mat4x4<f32>,
    view: mat4x4<f32>,
    projection: mat4x4<f32>,
    model_view: mat4x4<f32>,
    normal_matrix: mat3x3<f32>,
    camera_position: vec3<f32>
};

@group(0) @binding(0)
var<uniform> uniforms: BaseUniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let world_position = (uniforms.model * vec4<f32>(input.POSITION + input.INSTANCE_POSITION, 1.0)).xyz;
    let view_position = (uniforms.view * vec4<f32>(world_position, 1.0)).xyz;
    output.clip_position = uniforms.projection * vec4<f32>(view_position, 1.0);
    output.uv = input.TEXCOORD_0;
    return output;
}
@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(input.uv, 0.5, 1.0);
}

    `,
    [base],
    updateBase
  )

  return (
    <Canvas camera={camera()} ref={setCanvas}>
      <PerspectiveCamera label="main_camera" ref={setCamera} position={[0, 0, 5]} aspect={16 / 9} />

      <Mesh geometry={planeGeo} material={mat()} scale={[0.1, 0.1, 0.1]} />
    </Canvas>
  )
}

render(() => <App />, document.getElementById('app')!)
