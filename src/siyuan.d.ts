declare module "siyuan" {
    export class Plugin {
        constructor(options: unknown);
        addDock(options: {
            config: {
                position: string;
                size: { width: number; height: number };
                icon: string;
                title: string;
                hotkey?: string;
            };
            data: unknown;
            type: string;
            init: (dock: { element?: HTMLElement }) => void;
            destroy: () => void;
        }): void;
        addStatusBar(options: { element: HTMLElement }): void;
        addTopBar(options: {
            icon: string;
            title: string;
            position: string;
            callback: () => void;
            contextMenu?: (menu: {
                addItem: (opts: { icon?: string; label: string; click: () => void }) => void;
            }) => void;
        }): HTMLElement;
        addCommand(options: { langKey: string; hotkey?: string; execute: () => void }): void;
        loadData(name: string): Promise<unknown>;
        saveData(name: string, data: unknown): Promise<void>;
        eventBus: {
            on(type: string, listener: (...args: unknown[]) => void): void;
            off(type: string, listener: (...args: unknown[]) => void): void;
        };
    }

    export function showMessage(message: string, timeout?: number): void;
}
