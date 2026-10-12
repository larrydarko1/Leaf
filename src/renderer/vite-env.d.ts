/// <reference types="vite/client" />

declare module '*.vue' {
    import { type DefineComponent } from 'vue';
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the shape Vue's own SFC shim declares
    const component: DefineComponent<{}, {}, unknown>;
    export default component;
}
