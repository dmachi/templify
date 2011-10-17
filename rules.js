var escape = require("./parse").escape;
var toJSON = require("commonjs-utils/json-ext").stringify;
var when = require("promised-io/promise").when;

exports.Rules = function(options){
	var resolver = options.resolver;
	var Template = require("./template").Template;
	
	return	{
		statement: {
			opener: '{%',
			closer: '%}',
		
			tags: {
				'extend':{
					arguments: '{template}',
					type: 'single',
					handler: function(tree, content, caller){
						var templateName = tree.arguments.template;
						//console.log("DO EXTEND: " + templateName);	
						caller._extend = {
							blocks: {},
							templateName: templateName
						}
	
						if (caller.extension){
							//console.log("found caller.extentsion");
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
						//console.log("BLOCK: " + blockName);	
						//console.log("  _subclass blocks: " + caller.extension[blockName]); 

						if (!blockName){
							throw new Error("Ivalid blockName >" + blockName + "<");
						}
						if (caller.extension && caller.extension.blocks[blockName]){
							//console.log("  current extended block: " + caller.extension.blocks[blockName]);
							if (caller._extend){
								//console.log("   Extending Again, use previous if available");
								caller._extend.blocks[blockName]=caller.extension.blocks[blockName];
								//console.log("     From extension: " + caller._extend.blocks[blockName]); 
							
							}// else{
							  	//console.log("returning _extended block");
							 	//console.log("     From extension: " + caller.extension.blocks[blockName]); 
							return caller.extension.blocks[blockName];
							//}	
						}else if (caller._extend){
							//console.log("Add extended block " + blockName);
							caller._extend.blocks[blockName]=content;	
							return caller._extend.blocks[blockName];
								//console.log("     added block: " + caller._extend.blocks[blockName]); 
						}else{
							//console.log("Returning block content directly");
							//console.log("     Direct: " + content);
							return content;	
						}		
					}
				},

				'include': {
					arguments: '{template}',
					type: 'single',
					handler: function(tree, content, caller){
						var templateName = tree.arguments.template;
						var template = Template(resolver(templateName), options, true); 
	
//						console.log("Do IMPORT of template: " + templateName + ":" + template);	
						return when(template, function(template){
//							console.log("included template: ", template);
							return template;
						});
					}
				},




				'json': {
					arguments: '{obj}',
					type: 'single',
					handler: function(tree, content, caller){
						var obj= tree.arguments.obj;
						var x = ['_write(JSON.stringify(',obj,'));'].join('');
						return x;
					}
				},


				'render': {
					arguments: '{template} with {rootContext}',
					type: 'single',
					handler: function(tree, content, caller){
						var templateName = tree.arguments.template;
						var rootContext = tree.arguments.rootContext;
						var templateString = resolver(templateName, true);
						//console.log("Do RENDER of template: " + templateName + ": " + templateString);
						if (rootContext){
							var ret = ["with(",rootContext,"){",Template(templateString, options, true), "};"].join('');
							//console.log("Rendered Function Text with rootContext: " + ret);
							return ret;
						}
						//console.log("Rendered rootless functionText: " + subparser.functionText);	
						return Template(templateString,options);
					}
				},

				'set': {
					arguments: '{variable} to {args}',
					type: 'single',
					handler: function(tree, content, caller){
						var variable = tree.arguments.variable;
						var args= tree.arguments.args;
						return '$data["'+variable+'"]=' + args + ";";
					}
				},
				
				'foreach': {
					arguments: '{element} in {object}',
					type: 'block',
					handler: function(tree, content, caller) {
						var element = tree.arguments.element;
						var object = tree.arguments.object;
						//console.log("serialized tree arguments: " + serialize(tree));	
						//Check whether there are else tag after this tag, if yes, (if) tag will be included
						//var cond = (tree.parent.children[tree.nr+1] && tree.parent.children[tree.nr+1].tagname == 'else');
						//var iff = ['if( (',object,' instanceof Array && ',object,'.length > 0) || ',
						//			'(!(',object,' instanceof Array) && ',object,') ) {'].join('');
			
						var buf=[];
						//console.log("Foreach object: ", object, element);
						return [
							'var x=',object,';',	
							'x.forEach(function(', element,'){',
//								'console.log("serialized body item: " + serialize(', element, '));',
								//'var ', element, '=el;',content,
								//'console.log("item: ",',element,')',
								content,
							'},this);'
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
//						var cond = (tree.parent.children[tree.nr+1] && tree.parent.children[tree.nr+1].tagname == 'else');
//						var iff = ['if( (',object,' instanceof Array && ',object,'.length > 0) || ',
//									'(!(',object,' instanceof Array) && ',object,') ) {'].join('');
						return [
							'for(var i in ', object, '){',
								//'console.log("i: " + i + " " + ', object, '[i]);', 
								'var ', element, '=',object,'[i];', 	
								//'console.log("element: " + ',element,');',
								//'console.log("serialized element: " + serialize(', element,'));',
								//'console.log(".name " + ', element, '.name);',
								content,
							'}'
						].join('');
					}
				},
				
				'if': {
					type: 'block',
					
					handler: function(tree, content, caller) {
						var condition = tree.argSource;
						//console.log("if block: ", condition, "content:", content,"****");
						return [
							'if(',condition,'){',
								content,
							'}'
						].join('');
					}
				},
				
				'elseif': {
					type: 'block',
					noTextBefore: false,
					
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
					noTextBefore: false,
					handler: function(tree, content, caller) {
						//console.log("else handler: ", content);
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

				'log': {
					arguments: '{prefix} {obj}',
					type: "single",
					handler: function(tree, content, caller){
						var prefix = tree.arguments.prefix;
						var obj= tree.arguments.obj;	
						return 'console.log("' + prefix + '",' + obj + ');'
					}
				},
				
				'cdata': {
					type: 'block',
					handler: function(tree, content, caller) {
						return '_write(\''+escape(tree.innerSource, caller.escapeChars)+'\');';
					}
				}
			}
		},
	
		print: {
			opener: '${',
			closer: '}}',
			handler: function(tree, content, caller) {
				return 'if(' +tree.argSource+'!= undefined){_write('+tree.argSource+')}';
			}
		},
	
		alternatePrint: {
			opener: '{{',
			closer: '}}',
			handler: function(tree, content, caller) {
				//return 'if(' +tree.argSource+'!= undefined){_write('+tree.argSource+')}';
				//return '_write('+tree.argsource + " || '');";
				return '_write(('+tree.argSource+'||"").toString());';
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
	}
};
