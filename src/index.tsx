import ReactDOM from "react-dom";
import React, {
  ComponentType,
  FC,
  useDebugValue,
  useEffect,
  useRef,
  useState,
  ReactElement
} from "react";

type ModelHook<T = any> = () => T;

const modelMap = new Map<string, Container<any>>();

type Subscriber<T> = (data: T) => void;

class Container<T = unknown> {
  constructor(public hook: ModelHook<T>) {}
  subscribers = new Set<Subscriber<T>>();
  data!: T;

  notify() {
    console.log(this.hook.name, this.data);
    for (const subscriber of this.subscribers) {
      subscriber(this.data);
    }
  }
}

function Executor<T>(props: {
  hook: ModelHook<T>;
  onUpdate: (data: T) => void;
}) {
  const data = props.hook();
  props.onUpdate(data);
  return null as ReactElement;
}

export function setModel<T>(key: string, model: ModelHook<T>) {
  const element = document.createElement("div");
  const container = new Container(model);
  modelMap.set(key, container);
  ReactDOM.render(
    <Executor
      onUpdate={val => {
        container.data = val;
        container.notify();
      }}
      hook={model}
    />,
    element
  );
}

type Deps<T extends ModelHook> = (model: ReturnType<T>) => unknown[];

export function useModel<T extends ModelHook = any>(
  key: string,
  depsFn?: Deps<T>
) {
  type V = ReturnType<T>;
  useDebugValue(key);
  const container = modelMap.get(key) as Container<V>;
  const [state, setState] = useState<V | undefined>(() =>
    container ? (container.data as V) : undefined
  );
  const depsRef = useRef<unknown[]>([]);
  useEffect(() => {
    if (!container) return;
    function subscriber(val: V) {
      if (!depsFn) {
        setState(val);
      } else {
        const oldDeps = depsRef.current;
        const newDeps = depsFn(val);
        if (compare(oldDeps, newDeps)) {
          setState(val);
        }
        depsRef.current = newDeps;
      }
    }
    container.subscribers.add(subscriber);
    return () => {
      container.subscribers.delete(subscriber);
    };
  }, [container]);
  return state!;
}

export function selectModel<T extends ModelHook = any>(key: string) {
  type V = ReturnType<T>;
  const container = modelMap.get(key) as Container<V>;
  return container ? (container.data as V) : undefined;
}

export interface WithModelProps {
  model: {
    [key: string]: unknown;
  };
}

// TODO 支持多个 model
// 1. 可以支持数组 和 字符串
// TODO 支持重命名 model，this.props.model 如果本来组件就有这个名字了，就有问题了，需要支持重命名。
// 1. 支持接收函数，函数的参数为所有的 model 数据，类似 react-redux {[key]: modelMap[key].data}
export function withModel<T extends ModelHook = any>(key: string) {
  return function<P extends WithModelProps>(C: ComponentType<P>) {
    const Wrapper: FC<Omit<P, "model">> = function(props) {
      const componentProps: P = ({
        ...props,
        model: {
          [key]: useModel<T>(key)
        }
      } as unknown) as P;
      return <C {...componentProps} />;
    };
    Wrapper.displayName = `${C.displayName}Wrapper`;
    return Wrapper;
  };
}

function compare(oldDeps: unknown[], newDeps: unknown[]) {
  if (oldDeps.length !== newDeps.length) {
    return true;
  }
  for (const index in newDeps) {
    if (oldDeps[index] !== newDeps[index]) {
      return true;
    }
  }
  return false;
}
