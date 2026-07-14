import { createSignal, Show } from 'solid-js'
import { render } from '@solidjs/web'
import type { CameraRef, QuatLike, Vec3Like } from 'solid-webgpu'
import {
  Canvas,
  createOrbitControl,
  createPBRMaterial,
  createPlaneGeometry,
  imageBitmapFromImageUrl,
  Mesh,
  PerspectiveCamera,
  PunctualLight,
  Quat
} from 'solid-webgpu'

const Avatar = (props: {
  texture: ImageBitmap
  position?: Vec3Like
  quaternion?: QuatLike
}) => {
  const planeGeo = createPlaneGeometry()
  const pbrMat = createPBRMaterial(() => ({
    albedoTextureSource: props.texture,
    occlusionRoughnessMetallicTextureSource: props.texture
  }))

  return (
    <Mesh
      geometry={planeGeo}
      material={pbrMat()}
      position={props.position}
      quaternion={props.quaternion}
    />
  )
}

const App = (props: { texture: ImageBitmap }) => {
  const [p, setP] = createSignal(0)
  const [camera, setCamera] = createSignal<CameraRef>()
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>()

  createOrbitControl(canvas, camera)

  const [r, setR] = createSignal(Quat.create(), { equals: false })
  const update = (t: number) => {
    setR(v => {
      Quat.fromEuler(v, 0, 0, t / 20)
      return v
    })
  }

  const planeGeo = createPlaneGeometry()

  // create object3d outside canvas context
  const x = <Mesh geometry={planeGeo} position={[-3, 0, 0]} quaternion={r()} />

  return (
    <>
      <Canvas camera={camera()} ref={setCanvas} update={update}>
        <PerspectiveCamera label="main_camera" ref={setCamera} position={[0, 0, 5]} aspect={16 / 9} />
        <PunctualLight
          type="spot"
          position={[0, 1.5, 0.5]}
          quaternion={Quat.fromEuler(Quat.create(), 90, 0, 0)}
          color={[1, 1, 1]}
          intensity={100}
        />
        {x}
        <Avatar texture={props.texture} position={[0, p(), 0]} />

        {/* conditional rendering */}
        <Show when={p() % 2 === 1}>
          <Avatar texture={props.texture} position={[3, 0, 0]} />
        </Show>
      </Canvas>

      <button onClick={() => setP(v => (v + 1) % 5)}>set position</button>
    </>
  )
}

const texture = await imageBitmapFromImageUrl('../../static/a.png')
render(() => <App texture={texture} />, document.getElementById('app')!)
