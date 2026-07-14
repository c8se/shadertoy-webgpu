import { Mat4, Quat, QuatLike, Vec3, Vec3Like } from '@rubick24/math'
import {
  type Accessor,
  children,
  type ChildrenReturn,
  createEffect,
  createSignal,
  createStore,
  createUniqueId,
  For,
  onSettled,
  type Setter,
  type StoreSetter,
  untrack
} from 'solid-js'
import type { JSX } from '@solidjs/web'
import {
  $OBJECT3D,
  $WGPU_COMPONENT,
  isObject3DComponent,
  isWgpuComponent,
  NodeProps,
  NodeRef,
  Object3DComponent,
  Object3DExtra,
  Object3DRef,
  SceneContext,
  StoreContext,
  WgpuComponent
} from './types'

export type Object3DProps<T = {}> = NodeProps<T> & {
  position?: Vec3Like
  quaternion?: QuatLike
  scale?: Vec3Like
}

const DEFAULT_POSITION: Vec3Like = [0, 0, 0]
const DEFAULT_QUATERNION: QuatLike = [0, 0, 0, 1]
const DEFAULT_SCALE: Vec3Like = [1, 1, 1]

// Context wiring is imperative: descendants must see the new context during
// the same render pass, while subscribers can still update in Solid's normal
// microtask batch. The internal revision signal opts into owned writes because
// propagation happens from custom renderer scopes.
const createContextSignal = <T,>() => {
  let value: T | undefined
  const [revision, setRevision] = createSignal(0, { ownedWrite: true })
  const read: Accessor<T | undefined> = () => {
    revision()
    return value
  }
  const write = ((next?: T | ((previous: T | undefined) => T | undefined)) => {
    value =
      typeof next === 'function'
        ? (next as (previous: T | undefined) => T | undefined)(value)
        : next
    setRevision(current => current + 1)
    return value
  }) as Setter<T | undefined>
  return [read, write] as const
}

export const createNodeRef = <T extends NodeRef>(
  props: Omit<NodeProps, 'ref'>,
  ch: ChildrenReturn,
  init?: Omit<T, keyof NodeRef>
) => {
  const [sceneCtx, setSceneCtx] = createContextSignal<StoreContext<SceneContext>>()

  const nodeRef: NodeRef = {
    [$WGPU_COMPONENT]: true as const,
    id: createUniqueId(),
    label: '',
    scene: sceneCtx,
    ...init
  }
  const id = nodeRef.id

  const [store, setStore] = createStore<NodeRef>(nodeRef)
  createEffect(
    () => props.label ?? '',
    label =>
      setStore(node => {
        node.label = label
      })
  )

  // register node to scene
  createEffect(
    () => sceneCtx()?.[1],
    setScene => {
      if (!setScene) return
      setScene(scene => {
        scene.nodes[id] = store
      })
      return () =>
        setScene(scene => {
          delete scene.nodes[id]
        })
    }
  )

  return {
    // Extensions are installed in the initial value before the store is
    // created; preserve that richer public type across this internal boundary.
    store: store as T,
    setStore: setStore as unknown as StoreSetter<T>,
    comp: {
      [$WGPU_COMPONENT]: true as const,
      id,
      setSceneCtx,
      render: () => {
        untrack(() => {
          const currentScene = sceneCtx()
          ch.toArray().forEach(child => {
            if (isWgpuComponent(child)) {
              child.setSceneCtx(currentScene)
            }
          })
        })
        return null
      }
    } satisfies WgpuComponent
  }
}
export const wgpuCompRender = (ch: ChildrenReturn) => (
  <For each={ch.toArray()}>
    {child => {
      if (isWgpuComponent(child)) {
        return untrack(() => child.render())
      }
      return child
    }}
  </For>
)

export const createObject3DRef = <T extends Object3DRef>(
  props: Omit<Object3DProps, 'ref'>,
  ch: ChildrenReturn,
  init?: Omit<T, keyof Object3DRef>
) => {
  const m = createSignal(Mat4.create(), { equals: false })
  const p = createSignal(Vec3.create(), { equals: false })
  const q = createSignal(Quat.create(), { equals: false })
  const s = createSignal(Vec3.fromValues(1, 1, 1), { equals: false })
  const u = createSignal(Vec3.fromValues(0, 1, 0), { equals: false })
  const o3dExt: Object3DExtra = {
    [$OBJECT3D]: true,
    matrix: m[0],
    setMatrix: m[1],
    position: p[0],
    setPosition: p[1],
    quaternion: q[0],
    setQuaternion: q[1],
    scale: s[0],
    setScale: s[1],
    up: u[0],
    setUp: u[1]
  }

  const { store, setStore, comp } = createNodeRef<Object3DRef>(props, ch, { ...init, ...o3dExt })

  createEffect(
    () => props.position ?? DEFAULT_POSITION,
    position => {
      untrack(() => {
        store.setPosition(v => {
          v.copy(position)
          return v
        })
      })
    }
  )

  createEffect(
    () => props.quaternion ?? DEFAULT_QUATERNION,
    quaternion => {
      untrack(() => {
        store.setQuaternion(v => {
          v.copy(quaternion)
          return v
        })
      })
    }
  )

  createEffect(
    () => props.scale ?? DEFAULT_SCALE,
    scale => {
      untrack(() => {
        store.setScale(v => {
          v.copy(scale)
          return v
        })
      })
    }
  )

  const [parentCtx, setParentCtx] = createContextSignal<Pick<Object3DRef, 'matrix'>>()

  // update matrix
  createEffect(
    () => ({
      quaternion: store.quaternion(),
      position: store.position(),
      scale: store.scale(),
      parentMatrix: parentCtx()?.matrix()
    }),
    values => {
      untrack(() => {
        store.setMatrix(m => {
          Mat4.fromRotationTranslationScale(m, values.quaternion, values.position, values.scale)
          if (values.parentMatrix) {
            Mat4.mul(m, values.parentMatrix, m)
          }
          return m
        })
      })
    }
  )

  return {
    store: store as T,
    setStore: setStore as unknown as StoreSetter<T>,
    comp: {
      ...comp,
      [$OBJECT3D]: true as const,
      setParentCtx,
      render: () => {
        untrack(() => {
          comp.render()
          ch.toArray().forEach(child => {
            if (isObject3DComponent(child)) {
              child.setParentCtx(store)
            }
          })
        })
        return null
      }
    } satisfies Object3DComponent
  }
}

export const Object3D = (props: Object3DProps) => {
  const ch = children(() => props.children)
  const { store, comp } = createObject3DRef(props, ch)

  onSettled(() => {
    props.ref?.(store)
  })

  return {
    ...comp,
    render: () => {
      comp.render()
      return wgpuCompRender(ch)
    }
  } satisfies Object3DComponent as unknown as JSX.Element
}
