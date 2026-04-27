export type ParserKind = 'tsx' | 'jsx';
export declare function runTransformAsync({ files, parser, transform, }: {
    files: string[];
    parser: ParserKind;
    transform: string;
}): Promise<void>;
