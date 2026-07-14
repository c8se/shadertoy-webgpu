import { createSignal } from 'solid-js'
import { render } from '@solidjs/web'
import { Canvas, createOrbitControl, PerspectiveCamera, type CameraRef } from 'solid-webgpu'
import { loadGLTF } from 'solid-webgpu-gltf'

const { json, scenes } = await loadGLTF('../../static/suzanne_unlit.glb')
const GLTFModel = scenes[0]

console.log(json)

const App = () => {
  const [camera, setCamera] = createSignal<CameraRef>()
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>()

  createOrbitControl(canvas, camera)

  return (
    <Canvas camera={camera()} ref={setCanvas}>
      <PerspectiveCamera label="main_camera" ref={setCamera} position={[0, 0, 5]} aspect={16 / 9} />
      <GLTFModel />
    </Canvas>
  )
}

render(() => <App />, document.getElementById('app')!)
