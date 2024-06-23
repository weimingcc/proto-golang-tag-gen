// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import Window = vscode.window;


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "proto-golang-tag-gen" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const addJsonNameCMD = vscode.commands.registerCommand('proto-golang-tag-gen.messageFieldAddJsonName', () => {
		if (Window.activeTextEditor != undefined) {
			let e = Window.activeTextEditor;
			let d = e.document;
			let sel = e.selections;

			messageFieldAddJsonName(e, d, sel)
		}
	});
	const addInjectTagsCMD = vscode.commands.registerCommand('proto-golang-tag-gen.messageFieldAddInjectTags', () => {
		if (Window.activeTextEditor != undefined) {
			let e = Window.activeTextEditor;
			let d = e.document;
			let sel = e.selections;

			messageFieldAddInjectTags(e, d, sel)
		}
	});
	const addJsonNameAndInjectTagsCMD = vscode.commands.registerCommand('proto-golang-tag-gen.messageFieldAddJsonNameAndInjectTags', () => {
		if (Window.activeTextEditor != undefined) {
			let e = Window.activeTextEditor;
			let d = e.document;
			let sel = e.selections;

			messageFieldAddJsonNameAndInjectTags(e, d, sel)
		}
	});
	context.subscriptions.push(addJsonNameCMD, addInjectTagsCMD, addJsonNameAndInjectTagsCMD);
}

// This method is called when your extension is deactivated
export function deactivate() {}

// var output: string = ""
function messageFieldAddJsonName(e: vscode.TextEditor, d: vscode.TextDocument, sel: readonly vscode.Selection[]) {
	e.edit(function(edit) {
		sel.forEach(function(s){
			let txt: string = d.getText(new vscode.Range(s.start, s.end));
			let output = handle(txt, Action.AddJsonNameOption)
			// console.log(output);
			edit.replace(s, output);
		})
	})
}

function messageFieldAddInjectTags(e: vscode.TextEditor, d: vscode.TextDocument, sel: readonly vscode.Selection[]) {
	e.edit(function(edit) {
		sel.forEach(function(s){
			let txt: string = d.getText(new vscode.Range(s.start, s.end));
			let output = handle(txt, Action.AddInjectTags)
			// console.log(output);
			edit.replace(s, output);
		})
	})
}

function messageFieldAddJsonNameAndInjectTags(e: vscode.TextEditor, d: vscode.TextDocument, sel: readonly vscode.Selection[]) {
	e.edit(function(edit) {
		sel.forEach(function(s){
			let txt: string = d.getText(new vscode.Range(s.start, s.end));
			let output = handle(txt, Action.AddJsonNameOptionAndInjectTags)
			// console.log(output);
			edit.replace(s, output);
		})
	})
}

function handle(txt: string, action: Action) :string {
	if(txt.length == 0) {
		return "";
	}
	let lines = splitLines(txt)
	let scanner = new Scanner(lines)
	let output: string = ""
	while(scanner.next()) {
		let line = scanner.line()
		let words = splitWords(line)
		if(words.length < 2) {
			output += toLine(line)
			continue
		}
		switch (words[0]) {
			case KeyWordMessage:
				output += toLine(line)
				output += scanMessage(scanner, action)
				break
			default:
				output += toLine(line)
				break
		}
	}
	return output
}

function scanMessage(scanner: Scanner, action: Action) :string {
	let output: string = ""
	while(scanner.next() && !scanner.line().trim().endsWith("}")) {
		let line = scanner.line()
		let words = splitWords(line)
		if(words.length < 2) {
			output += toLine(line)
			continue
		}
		switch(words[0]) {
			case KeyWordMessage:
				output += toLine(line)
				output += scanMessage(scanner, action)
				break
			case "//":
				output += toLine(line)
				if(line.includes("@inject_tags:") && scanner.next()) {
					// have inject_tags, skip
					output += setMessageField(scanner.line(), action, true)
				}
				break
			default:
				output += setMessageField(scanner.line(), action, false)
				break
		}
	}
	if(scanner.line().length != 0) {
		output += toLine(scanner.line())
	}
	return output
}

function setMessageField(line: string, action: Action, hasInjectTags: boolean) :string {
	switch(action) {
		case Action.AddJsonNameOption:
			return addJsonNameToMessageField(line);
		case Action.AddInjectTags:
			if (!hasInjectTags) {
				return addInjectTags(line) + toLine(line);
			}
		case Action.AddJsonNameOptionAndInjectTags:
			return hasInjectTags ? addJsonNameToMessageField(line): 
							addInjectTags(line)+addJsonNameToMessageField(line);
			
	}
}

function addInjectTags(line: string) :string {
	let words = splitWords(line)
	if (words.length < 2) {
		return toLine(line);
	}
	let injectLine = toLine("// @inject_tags: json:\"" + words[1] + "\"")

	let indent = line.match(/^[\s\p]+/);
	return indent == null ? injectLine: indent + injectLine;
}

function addJsonNameToMessageField(line: string) {
	let words = splitWords(line)
	if(words.length < 2) {
		return toLine(line);
	}
	let jsonNameOption = "json_name=\"" + words[1] + "\"";

	let parts = line.match(/\[(.*?)\]/);
	if (parts != null && parts.length > 1) { // have options
		if(parts[1].includes("json_name=")) {
			return toLine(line)
		}
		let fieldOptions = fieldOption(parts[1]+", "+jsonNameOption);
		line = line.split("[")[0] + fieldOptions + ";";
		return toLine(line);
	}
	// no options
	line = line.trimEnd().replace(";", "") + fieldOption(jsonNameOption) + ";";
	return toLine(line)
}

class Scanner {
	index: number;
	token: string;
	lines: string[];
	constructor(lines: string[]) {
		this.index = 0;
		this.lines = lines;
		this.token = '';
	}
	next() :boolean {
		if(this.index >= this.lines.length) {
			this.token = "";
			return false;
		}
		this.token = this.lines[this.index]
		this.index+=1

		return true
	}
	line() :string {
		return this.token;
	}
}

enum Action {
	AddJsonNameOption = 1,
	AddInjectTags,
	AddJsonNameOptionAndInjectTags
}

const KeyWordMessage = "message"
const toLine = (str: string) => str+"\n";
const fieldOption = (str: string) => " [" + str + "]";
const splitLines = (str: string) => str.split(/\r?\n/);
const splitWords = (str: string) => str.split(/(\s+)/).filter(function (e) {return e.trim().length > 0});