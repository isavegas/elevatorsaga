
import * as ts from "typescript";
declare const monaco: typeof import('monaco-editor')
import { Uri, languages, editor as meditor } from 'monaco-editor'; // Note: Must only import type definitions, or runtime crash!

import { CodeEditorBase, debounce } from './common.js'

const TS_COMPILER_OPTS: languages.typescript.CompilerOptions = {
	allowNonTsExtensions: true,
	inlineSourceMap: true,
	isolatedModules: true,
	module: monaco.languages.typescript.ModuleKind.ESNext,
	moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
	noImplicitAny: false,
	allowJs: true,
	noLib: true,
	libs: ["esnext", "dom"],
	//target: "esnext",
	target: monaco.languages.typescript.ScriptTarget.ESNext,
	outFile: "UserCode.js",
	sourceRoot: "/",
	strict: true,
	//suppressOutputPathCheck: true, // Found on TS playground?
	//target: monaco.languages.typescript.ScriptTarget.ES2018,
	typeRoots: ["/"],
}

export class MonacoEditor extends CodeEditorBase {
	mco: meditor.IStandaloneCodeEditor;

	constructor(hostElement: HTMLElement, lsKey: string) {
		super(lsKey);

		monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
			noSemanticValidation: false,
			noSyntaxValidation: false,
		});
		monaco.languages.typescript.typescriptDefaults.setCompilerOptions(TS_COMPILER_OPTS);
		monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

		const model = monaco.editor.createModel(this.defaultText(true), 'typescript', monaco.Uri.parse("file:///UserCode.ts"))
		this.mco = monaco.editor.create(hostElement, {
			formatOnPaste: true,
			formatOnType: true,
			model,
			theme: "vs-light",
		});

		// Resize monaco on window resize
		window.addEventListener("resize", () => this.mco.layout());

		const autoSaver = debounce(() => this.saveCode(), 1000);
		this.mco.onDidChangeModelContent(autoSaver);

		this.init();
	}

	focus(): void {
		this.mco.focus();
	}

	get codeText() {
		return this.mco.getValue();
	}
	set codeText(text: string) {
		console.log("Setting Monaco text...")

		const m = this.mco.getModel()
		if(m === null)
			throw new Error('Editor was found to have no model when retrieving content!')
		m.pushEditOperations([], [{
			range: m.getFullModelRange(),
			text,
		}], () => null);
	}
}
