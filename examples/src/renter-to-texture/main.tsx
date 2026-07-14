import { createSignal } from 'solid-js'
import { render } from '@solidjs/web'
import {
  Canvas,
  createOrbitControl,
  createPlaneGeometry,
  createRender,
  createTexture,
  createUnlitMaterial,
  Mesh,
  PerspectiveCamera,
  PunctualLight,
  Quat,
  type CameraRef
} from 'solid-webgpu'
import { loadGLTF } from 'solid-webgpu-gltf'

const { json, scenes } = await loadGLTF('../../static/axis.glb')
const GLTFModel = scenes[0]

console.log(json)

const App = () => {
  const [texCamera, setTexCamera] = createSignal<CameraRef>()
  const [camera, setCamera] = createSignal<CameraRef>()
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>()

  // createOrbitControl(canvas, camera)
  createOrbitControl(canvas, texCamera)

  const texture = createTexture({
    size: { width: 512, height: 512 },
    format: navigator.gpu.getPreferredCanvasFormat(),
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.COPY_DST
  })

  const [updateSignal, setUpdateSignal] = createSignal(0, { equals: false })

  createRender(
    () => ({
      texture: texture(),
      clearValue: { r: 0, g: 0.5, b: 1.0, a: 1.0 },
      camera: texCamera(),
      update: () => {
        setUpdateSignal(0)
      }
    }),
    () => (
      <>
        <PerspectiveCamera label="render_to_texture_camera" ref={setTexCamera} position={[0, 0, 5]} aspect={1} />
        <PunctualLight
          type="spot"
          position={[0, 3, 0.5]}
          quaternion={Quat.fromEuler(Quat.create(), 90, 0, 0)}
          color={[1, 1, 1]}
          intensity={100}
        />

        <GLTFModel />
      </>
    )
  )

  const planeGeo = createPlaneGeometry()
  const unlitMat = createUnlitMaterial(() => ({
    albedoTexture: texture()
  }))

  return (
    <>
      <Canvas camera={camera()} ref={setCanvas} updateSignal={updateSignal}>
        <PerspectiveCamera label="main_camera" ref={setCamera} position={[0, 0, 5]} aspect={16 / 9} />
        <Mesh geometry={planeGeo} material={unlitMat()} />
      </Canvas>
    </>
  )
}

render(() => <App />, document.getElementById('app')!)
