import { Container } from 'inversify';
import { DOMSelectorService } from '../../../src/services/DomSelectorService';
import { TYPES } from '../../../src/types/Symbols';

describe('DOMSelectorService', () => {
  let container: Container;
  let service: DOMSelectorService;
  let mockDocument: Document;

  beforeEach(() => {
    // 设置容器
    container = new Container();
    container.bind<DOMSelectorService>(TYPES.DOMSelectorService).to(DOMSelectorService);
    service = container.get<DOMSelectorService>(TYPES.DOMSelectorService);

    // 创建模拟DOM环境
    document.body.innerHTML = '';
  });

  describe('getFileExplorers', () => {
    it('should find standard file explorer', () => {
      const explorer = document.createElement('div');
      explorer.className = 'nav-files-container';
      document.body.appendChild(explorer);

      const result = service.getFileExplorers();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(explorer);
    });

    it('should find alternative explorers', () => {
      const explorer1 = document.createElement('div');
      explorer1.className = 'file-explorer-container';
      const explorer2 = document.createElement('div');
      explorer2.className = 'nav-folder-children';
      document.body.appendChild(explorer1);
      document.body.appendChild(explorer2);

      const result = service.getFileExplorers();
      expect(result).toHaveLength(2);
      expect(result).toContain(explorer1);
      expect(result).toContain(explorer2);
    });

    it('should handle errors gracefully', () => {
      // 模拟document.querySelector抛出错误
      const mockQuerySelector = jest.spyOn(document, 'querySelector');
      mockQuerySelector.mockImplementation(() => {
        throw new Error('Mock error');
      });

      const result = service.getFileExplorers();
      expect(result).toEqual([]);

      // 清理mock
      mockQuerySelector.mockRestore();
    });
  });

  describe('getFileItems', () => {
    let explorer: HTMLElement;

    beforeEach(() => {
      explorer = document.createElement('div');
    });

    it('should find standard nav-file items', () => {
      const item = document.createElement('div');
      item.className = 'nav-file';
      explorer.appendChild(item);

      const result = service.getFileItems(explorer);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(item);
    });

    it('should find tree-items with data-path', () => {
      const item = document.createElement('div');
      item.className = 'tree-item';
      item.setAttribute('data-path', 'test.md');
      explorer.appendChild(item);

      const result = service.getFileItems(explorer);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(item);
    });

    it('should return empty array when no items found', () => {
      const result = service.getFileItems(explorer);
      expect(result).toEqual([]);
    });
  });

  describe('getTextElements', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
    });

    it('should find text elements', () => {
      const textEl = document.createElement('span');
      textEl.textContent = 'Test Text';
      container.appendChild(textEl);

      const result = service.getTextElements(container);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(textEl);
    });

    it('should exclude buttons and input elements', () => {
      const button = document.createElement('button');
      button.textContent = 'Click me';
      const input = document.createElement('input');
      input.value = 'Test input';
      container.appendChild(button);
      container.appendChild(input);

      const result = service.getTextElements(container);
      expect(result).toHaveLength(0);
    });
  });

  describe('getTitleElement', () => {
    let fileItem: HTMLElement;

    beforeEach(() => {
      fileItem = document.createElement('div');
    });

    it('should find standard title element', () => {
      const titleEl = document.createElement('div');
      titleEl.className = 'nav-file-title-content';
      fileItem.appendChild(titleEl);

      const result = service.getTitleElement(fileItem);
      expect(result).toBe(titleEl);
    });

    it('should find alternative title elements', () => {
      const titleEl = document.createElement('div');
      titleEl.className = 'tree-item-inner';
      fileItem.appendChild(titleEl);

      const result = service.getTitleElement(fileItem);
      expect(result).toBe(titleEl);
    });

    it('should return null when no title element found', () => {
      const result = service.getTitleElement(fileItem);
      expect(result).toBeNull();
    });
  });

  describe('getFilePath', () => {
    let fileItem: HTMLElement;

    beforeEach(() => {
      fileItem = document.createElement('div');
    });

    it('should get path from data-path attribute', () => {
      fileItem.setAttribute('data-path', 'test.md');

      const result = service.getFilePath(fileItem);
      expect(result).toBe('test.md');
    });

    it('should get path from parent element', () => {
      const parent = document.createElement('div');
      parent.setAttribute('data-path', 'parent/test.md');
      parent.appendChild(fileItem);

      const result = service.getFilePath(fileItem);
      expect(result).toBe('parent/test.md');
    });

    it('should get path from child element', () => {
      const child = document.createElement('div');
      child.setAttribute('data-path', 'child/test.md');
      fileItem.appendChild(child);

      const result = service.getFilePath(fileItem);
      expect(result).toBe('child/test.md');
    });

    it('should get path from internal link', () => {
      const link = document.createElement('a');
      link.className = 'internal-link';
      link.setAttribute('href', '/test.md');
      fileItem.appendChild(link);

      const result = service.getFilePath(fileItem);
      expect(result).toBe('test.md');
    });

    it('should return null when no path found', () => {
      const result = service.getFilePath(fileItem);
      expect(result).toBeNull();
    });
  });
}); 