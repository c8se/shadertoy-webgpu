import { createMemo, createSignal, Loading } from 'solid-js'
import { Dynamic, render } from '@solidjs/web'
import { Canvas, createOrbitControl, PerspectiveCamera, PunctualLight, Quat, type CameraRef } from 'solid-webgpu'
import { loadGLTF } from 'solid-webgpu-gltf'

const App = () => {
  const model = createMemo(() => loadGLTF('../../static/suzanne.glb'))

  const [camera, setCamera] = createSignal<CameraRef>()
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>()

  createOrbitControl(canvas, camera)

  return (
    <Loading fallback={null}>
      <Canvas camera={camera()} ref={setCanvas}>
        <PerspectiveCamera label="main_camera" ref={setCamera} position={[0, 0, 5]} aspect={16 / 9} />
        <PunctualLight
          type="spot"
          position={[0, 5, 5]}
          quaternion={Quat.fromEuler(Quat.create(), 120, 0, 0)}
          color={[1, 1, 1]}
          intensity={50}
        />

        <Dynamic component={model().scenes[0]} />
      </Canvas>
    </Loading>
  )
}

render(() => <App />, document.getElementById('app')!)
