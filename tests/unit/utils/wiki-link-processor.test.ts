import { 
    extractWikiLinks, 
    extractSimpleWikiLinks, 
    shouldReplaceTitle,
    WikiLink
} from '../../../src/utils/wiki-link-processor';

describe('Wiki Link Processor', () => {
    describe('extractWikiLinks', () => {
        it('should extract basic wiki links', () => {
            const text = 'Some text with [[fileName]] link.';
            const links = extractWikiLinks(text);
            
            expect(links).toHaveLength(1);
            expect(links[0].fileName).toBe('fileName');
            expect(links[0].fullMatch).toBe('[[fileName]]');
            expect(links[0].displayText).toBeUndefined();
            expect(links[0].subPath).toBeUndefined();
        });
        
        it('should extract wiki links with display text', () => {
            const text = 'Link with [[fileName|Display Text]].';
            const links = extractWikiLinks(text);
            
            expect(links).toHaveLength(1);
            expect(links[0].fileName).toBe('fileName');
            expect(links[0].displayText).toBe('Display Text');
            expect(links[0].subPath).toBeUndefined();
        });
        
        it('should extract wiki links with subpath', () => {
            const text = 'Link with [[fileName#section]].';
            const links = extractWikiLinks(text);
            
            expect(links).toHaveLength(1);
            expect(links[0].fileName).toBe('fileName');
            expect(links[0].displayText).toBeUndefined();
            expect(links[0].subPath).toBe('section');
        });
        
        it('should handle multiple links', () => {
            const text = '[[link1]] and [[link2|Display]] and [[link3#section]].';
            const links = extractWikiLinks(text);
            
            expect(links).toHaveLength(3);
            expect(links[0].fileName).toBe('link1');
            expect(links[1].fileName).toBe('link2');
            expect(links[1].displayText).toBe('Display');
            expect(links[2].fileName).toBe('link3');
            expect(links[2].subPath).toBe('section');
        });
        
        it('should compute correct positions with lineStart', () => {
            const text = 'Text [[link]] more.';
            const links = extractWikiLinks(text, 100);
            
            expect(links[0].start).toBe(105); // 100 + 5
            expect(links[0].end).toBe(113);   // 100 + 5 + 8
        });
    });
    
    describe('extractSimpleWikiLinks', () => {
        it('should extract only simple wiki links', () => {
            const text = '[[simple]] and [[complex|Display]] and [[withSection#section]].';
            const links = extractSimpleWikiLinks(text);
            
            expect(links).toHaveLength(1);
            expect(links[0].fileName).toBe('simple');
        });
    });
    
    describe('shouldReplaceTitle', () => {
        it('should return true for links without display text', () => {
            const link: WikiLink = {
                fullMatch: '[[fileName]]',
                fileName: 'fileName',
                start: 0,
                end: 12
            };
            
            expect(shouldReplaceTitle(link)).toBe(true);
        });
        
        it('should return false for links with display text', () => {
            const link: WikiLink = {
                fullMatch: '[[fileName|Display]]',
                fileName: 'fileName',
                displayText: 'Display',
                start: 0,
                end: 20
            };
            
            expect(shouldReplaceTitle(link)).toBe(false);
        });
    });
}); 