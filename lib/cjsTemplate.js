var ZParse = require('./zparse').ZParse;

var Implementation = {
	statement: {
		opener: '{%',
		closer: '%}',
		
		tags: {
			'extend':{
				arguments: '{template}',
				type: 'single',
				handler: function(tree, content, caller){
					var templateName = tree.arguments.template;
					//print("DO EXTEND: " + templateName);	
					caller._extend = {
						blocks: {},
						templateName: templateName
					}

					if (caller.extension){
						for (var i in caller.extension.blocks){
							caller._extend.blocks[i] = caller.extension.blocks[i];
						}
					}	

					return [];
				}

			},
			'block':{
				arguments: '{blockName}',
				type: 'block',
				handler: function(tree, content, caller){
					var blockName = tree.arguments.blockName;
					//print("BLOCK: " + blockName);	
					//print("  _subclass blocks: " + serialize(caller.extension[blockName])); 
					if (!blockName){
						throw new Error("Ivalid blockName >" + blockName + "<");
					}
					if (caller.extension && caller.extension.blocks[blockName]){
						//print("  current extended block: " + caller.extension.blocks[blockName]);
						if (caller._extend){
							//print("   Extending Again, use previous if available");
							caller._extend.blocks[blockName]=caller.extension.blocks[blockName];
							//print("     From extension: " + caller._extend.blocks[blockName]); 
							
						} //else{
						  //	print("returning _extended block");
						 //	print("     From extension: " + caller.extension.blocks[blockName]); 
						return caller.extension.blocks[blockName];
						//}	
					}else if (caller._extend){
						//print("Add extended block " + blockName);
						caller._extend.blocks[blockName]=content;	
						return caller._extend.blocks[blockName];
							//print("     added block: " + caller._extend.blocks[blockName]); 
					}else{
						//print("Returning block content directly");
						//print("     Direct: " + content);
						return content;	
					}		
				}
			},

			'include': {
				arguments: '{template}',
				type: 'single',
				handler: function(tree, content, caller){
					var templateName = tree.arguments.template;
					var templateString = getTemplate(templateName);
					//print("Do IMPORT of template: " + templateName + ":" + templateString);
					var subparser = new ZParse(caller.implementation || Implementation);
					var fullFunc = subparser.parse(templateString);	
					return subparser.functionText;
				}
			},

			'render': {
				arguments: '{template} with {rootContext}',
				type: 'single',
				handler: function(tree, content, caller){
					var templateName = tree.arguments.template;
					var rootContext = tree.arguments.rootContext;
					var templateString = getTemplate(templateName);
					//print("Do RENDER of template: " + templateName + ": " + templateString);
					var subparser = new ZParse(caller.implementation || Implementation);
					var fullFunc = subparser.parse(templateString);	
					if (rootContext){
						var ret = ["with(",rootContext,"){",subparser.functionText, "};"].join('');
						//print("Rendered Function Text with rootContext: " + ret);
						return ret;
					}
					//print("Rendered rootless functionText: " + subparser.functionText);	
					return subparser.functionText;
				}
			},
			
			'foreach': {
				arguments: '{element} in {object}',
				type: 'block',
				handler: function(tree, content, caller) {
					var element = tree.arguments.element;
					var object = tree.arguments.object;
					//print("serialized tree arguments: " + serialize(tree));	
					//Check whether there are else tag after this tag, if yes, (if) tag will be included
					//var cond = (tree.parent.children[tree.nr+1] && tree.parent.children[tree.nr+1].tagname == 'else');
					//var iff = ['if( (',object,' instanceof Array && ',object,'.length > 0) || ',
					//			'(!(',object,' instanceof Array) && ',object,') ) {'].join('');
					return [
						'var x =', object,';',
						'x.forEach(function(', element,'){',
							//'print("serialized body item: " + serialize(', element, '));',
							//'var ', element, '=el;',content,
							content,
						'});',
					].join('');
				}
			},
			
			'for': {
				arguments: '{element} in {object}',
				type: 'block',
				handler: function(tree, content, caller) {
					var element = tree.arguments.element;
					var object = tree.arguments.object;
					
					//Check whether there are else tag after this tag, if yes, (if) tag will be included
//					var cond = (tree.parent.children[tree.nr+1] && tree.parent.children[tree.nr+1].tagname == 'else');
//					var iff = ['if( (',object,' instanceof Array && ',object,'.length > 0) || ',
//								'(!(',object,' instanceof Array) && ',object,') ) {'].join('');
					return [
						'for(var i in ', object, '){',
							//'print("i: " + i + " " + ', object, '[i]);', 
							'var ', element, '=',object,'[i];', 	
							//'print("element: " + ',element,');',
							//'print("serialized element: " + serialize(', element,'));',
							//'print(".name " + ', element, '.name);',
							content,
						'}'
					].join('');
				}
			},
			
			'if': {
				type: 'block',
				
				handler: function(tree, content, caller) {
					var condition = tree.argSource;
					return [
						'if(',condition,') {',
							content,
						'}'
					].join('');
				}
			},
			
			'elseif': {
				type: 'block',
				noTextBefore: true,
				
				handler: function(tree, content, caller) {
					var condition = tree.argSource;
					
					return [
						'else if(',condition,') {',
							content,
						'}'
					].join('');
				}
			},
			
			'else': {
				type: 'block',
				noTextBefore: true,
				
				handler: function(tree, content, caller) {
					return [
						'else {',
							content,
						'}'
					].join('');
				}
			},
			
			'macro': {
				arguments: '{name}({args})',
				type: 'block',
				handler: function(tree, content, caller) {
					var name = tree.arguments.name;
					var args = tree.arguments.args;
					
					var point = (name.indexOf('.') > 0);
					return [
						point?'':'var ', name,' = function(',args,') {',
							'var $text = [];',
							'var _write = function(text) {',
								'$text.push((typeof text == "number")?text:(text||""));',
							'};',
							content,
							'return $text.join("");',
						'};'
					].join('');
				}
			},
			
			'cdata': {
				type: 'block',
				handler: function(tree, content, caller) {
					return '_write(\''+ZParse.escape(tree.innerSource, caller.escapeChars)+'\');';
				}
			}
		}
	},
	
	print: {
		opener: '${',
		closer: '}}',
		handler: function(tree, content, caller) {
			return '_write('+tree.argSource+');';
		}
	},
	
	alternatePrint: {
		opener: '{{',
		closer: '}}',
		handler: function(tree, content, caller) {
			return '_write('+tree.argSource+');';
		}
	},
	
	script: {
		opener: '<%',
		closer: '%>',
		handler: function(tree, content, caller) {
			return tree.argSource;
		}
	},

	comment: {
		opener: '{#',
		closer: '#}',
		handler: function(tree, content, caller){
			return "<!-- " + tree.argSource + " -->";
		}
	}
};

exports.Template= function(templateString){
	var x = new ZParse(Implementation)
	x.parse(templateString);
	return x;
}
