import { createMemo, createSignal, Loading } from 'solid-js'
import { Dynamic, render } from '@solidjs/web'
import { Canvas, createOrbitControl, PerspectiveCamera, type CameraRef } from 'solid-webgpu'
import { loadGLTF } from 'solid-webgpu-gltf'

const App = () => {
  const model = createMemo(() => loadGLTF('../../static/suzanne_unlit.glb'))

  const [camera, setCamera] = createSignal<CameraRef>()
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>()

  createOrbitControl(canvas, camera)

  return (
    <Loading fallback={null}>
      <Canvas
        camera={camera()}
        ref={setCanvas}
        width={160}
        height={90}
        sampleCount={1}
        style={{
          'width': '960px',
          'height': '540px',
          'image-rendering': 'pixelated'
        }}
      >
        <PerspectiveCamera label="main_camera" ref={setCamera} position={[0, 0, 5]} aspect={16 / 9} />
        <Dynamic component={model().scenes[0]} />
      </Canvas>
    </Loading>
  )
}

render(() => <App />, document.getElementById('app')!)
