import 'reflect-metadata';

// Mock Obsidian API
const mockObsidian = {
  Plugin: class {},
  App: class {},
  Vault: class {},
  TFile: class {},
  Notice: class {},
  PluginSettingTab: class {},
  Workspace: class {},
  WidgetType: class {},
  EditorView: class {},
};

jest.mock('obsidian', () => mockObsidian);

// 简单模拟performance对象
if (typeof window.performance === 'undefined') {
  Object.defineProperty(window, 'performance', {
    value: { now: () => Date.now() },
    writable: true
  });
} 