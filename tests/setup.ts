import 'reflect-metadata';

// Mock Obsidian API
const mockObsidian = {
  Plugin: class {},
  App: class {},
  Vault: class {},
  TFile: class {},
  Notice: class {}
};

jest.mock('obsidian', () => mockObsidian); 