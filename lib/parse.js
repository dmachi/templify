
exports.parse = function(source,state,options){
	//print("parse options: ", options, options.rules);
	var functionText, rawSource = source,
		sourceArray = exports.toArray(source,state,options.rules);

	if ((!sourceArray.tags) || (sourceArray.tags.length<1)){
		//print("  no sourceArray tags")
		functionText = ["_write(", source, ");"].join("");
	}else{
		//print("call toTree()");
		var sourceTree = exports.toTree(sourceArray.all, state, options.rules);
	
		//print("call toScript()");
		functionText = exports.toScript(sourceTree, escapeChars, state,options.rules);
		if (state._extend){
			//print("perform _extend: ");
			functionText = extendTemplate(state,options.rules);
			//print("EXTENDED FUNCTION TEXT: " + this.functionText);
		}
	}

	return functionText;	
}

//TODO there is probably a lib for this somewhere already
var escapeChars = ['\\', '\'', '"', ['\n','\\n'], ['\t','\\t'], ['\r', '\\r']];

var escape = function(source, list) {
	for(var i=0; i<list.length; i++) {
		if(list[i] instanceof Array)
			source =  source.replace(new RegExp(list[i][0],'gi'), list[i][1]);
		else
			source = source.replace(new RegExp('\\'+list[i],'gi'), '\\'+list[i]);
	}
	return source;
};


exports.toArray= function(source, state, rules) {
	//print("toArray() rules:", rules);
//	for(var i in rules){
//		print("rules i: " + i);
//	}
	var opener, closer, delimiter;
	var text = [],
		tags = [],
		all = [];

	while(source) {
		for(var i in rules) {
			if(!delimiter || source.indexOf(rules[delimiter].opener) == -1)
				delimiter = i;
			if(source.indexOf(rules[i].opener) != -1)
				if(source.indexOf(rules[delimiter].opener) > source.indexOf(rules[i].opener))
					delimiter = i;
		}
		//print("delimiter:" + delimiter);
		opener = source.indexOf(rules[delimiter].opener);
		closer = source.indexOf(rules[delimiter].closer) + rules[delimiter].closer.length;
		
		if(opener != -1) {
			text.push(source.substring(0,opener));
			tags.push(source.substring(opener,closer));
			source = source.substring(closer);
		} else {
			text.push(source);
			source = '';
		}
	}
		
	for(var i=0; i<text.length; i++) {
		all.push(text[i]);
		if(tags[i])
			all.push(tags[i]);
	}
	return {text:text, tags:tags, all:all};
};

exports.parseArguments = function(source, expr) {
	//print("calling toArray with expr from parseArguments", expr);
	var args = exports.toArray(expr, {}, {expr:{opener:'\{',closer:'\}'}}).tags;
	expr = escape(expr, ['(' ,')' ,'[' ,']', ',', '.', '<', '>', '*', '$', '@']);
	for(var i=0; i<args.length; i++) {
		expr = expr.replace(args[i],'(.*)');
		args[i] = args[i].replace('\{', '').replace('\}', '');
	}
	var matches = source.match(new RegExp(expr));
	
	var result = {};
	if(matches)
		for(var i=0; i<args.length; i++) 
			result[args[i]] = matches[i+1];
	
	return result;
};

exports.parseTag = function(source, rules ) {
	// Parse Tag
	var delimiter;
	for(var i in rules) {
		//print("   testing for opener: " + rules[i].opener);
		//for (var j in rules[i]){
		//	print("         i: " + j + "::::" + rules[i][j]);
		//}
		if(source.indexOf(rules[i].opener) == 0) {
			delimiter = i;
			break;
		}
	}
	if(!delimiter)
		return false;
	source =  source.substring(rules[delimiter].opener.length, source.indexOf(rules[delimiter].closer));
	
	// Parse tag name
	var tagname = '';
	var closer = '';
	//print("    delimiter: " + delimiter);
	if(rules[delimiter].tags) {
		var tagArray = [];
		for(var i in rules[delimiter].tags)
			//print("    tag: " + i);
			tagArray.push(i);
		var regex = new RegExp('^(\/){0,1}('+tagArray.join('|')+')\\\s*(.*)');
		var res =  source.match(regex);
		if(!res)
			return false;
		closer = res[1]?true:false;
		tagname = res[2];
		source = res[3];
	}
	
	// Parse tag type
	if(tagname) {
		//print("TagName: " + tagname);
		if(rules[delimiter].tags[tagname].type == 'single' && closer)
			return false;
		if(rules[delimiter].tags[tagname].type == 'block' && closer)
			return { delimiter:delimiter, tagname:tagname, closer:true};
	}
	
	// Parse arguments
	var args = {};
	if(tagname && rules[delimiter].tags[tagname].arguments){
		//print("---" + rules[delimiter].tags[tagname].arguments);
		args = exports.parseArguments(source, rules[delimiter].tags[tagname].arguments);
	}else if(!tagname && rules[delimiter].arguments){
		args = exports.parseArguments(source, rules[delimiter].arguments);
	}		
	return {delimiter:delimiter, tagname:tagname, source:source, arguments:args};
};

exports.toTree = function(array, state, rules) {
	var obj, res, current, nr = 0;
	var doc = {
		isDocument:true,
		innerSource: array.join(''),
		children: []
	};
	
	var addChild = function(parent,child) {
		child.nr = parent.children.length;
		parent.children.push(child);
	};
	
	current = doc; 
	for(var i=0; i<array.length; i++) {
		//print("array[i]: " + array[i]);
		res = exports.parseTag(array[i], rules);
		//print ("parsed Tag: " );
		//for (var p in res){
		//	print(" --- " + p +  "--> " + res[p]);
		//}
		if(!res) {
			if(array[i]) {
				array[i].parent = current;
				addChild(current, array[i]);
			}
		} else {
			obj = {};
			
			obj.i = i;
			obj.tagname = res.tagname;
			obj.delimiter = res.delimiter;
			obj.arguments = res.arguments;
			obj.argSource = res.source;
			obj.parent = current;
			
			if(res.tagname && rules[res.delimiter].tags[res.tagname].noTextBefore 
				&& !res.closer && typeof current.children[current.children.length-1] == 'string')
					current.children.pop();
			
			if(res.tagname && rules[res.delimiter].tags[res.tagname].type == 'block'){
				if(!res.closer) {
					addChild(current, obj);
					current = obj;
					current.children = [];
				} else if(current.tagname == res.tagname) {
					current.innerSource = '';
					for(var j=current.i+1; j<i; j++){
						current.innerSource += array[j];
					}
					current = current.parent;
				}
			} else
				addChild(current, obj);
		}
	}
	
	return doc;
};

exports.toScript = function(tree, list, state, rules) {
	if(typeof tree == 'string'){
		return '_write(\''+escape(tree, list)+'\');';
	}
	
	var result, content = [];
	
	if(tree.children){
		for(var i=0; i<tree.children.length; i++){
			content.push(exports.toScript(tree.children[i], list, state, rules));
		}
	}

	if(!tree.isDocument) {
		if(tree.tagname){
			return rules[tree.delimiter].tags[tree.tagname].handler(tree, content.join(''), state);
		}else{
			//print("exports.toScript w/o tree.tagname: " +  serialize(content));
			try {
				return rules[tree.delimiter].handler(tree, content.join(''), state);
			}catch(err){
				print("Caught error : " + err);
			}
		}	
	} else {
		return content.join('');
	}
};

exports.XMLToJSON = function(xml) {
	var result;
	if(xml.childNodes && xml.childNodes.length == 1 && xml.childNodes[0].nodeName == "#text") {
		result = xml.childNodes[0].nodeValue;
	} else{
		result = {};
		for(var i=0; i<xml.childNodes.length; i++) {
			if(result[xml.childNodes[i].nodeName]) {
				if(!(result[xml.childNodes[i].nodeName] instanceof Array))
					result[xml.childNodes[i].nodeName] = [result[xml.childNodes[i].nodeName]];
				result[xml.childNodes[i].nodeName].push(exports.XMLToJSON(xml.childNodes[i]));
			}else if(xml.childNodes[i].nodeName.indexOf('#') == -1)
				result[xml.childNodes[i].nodeName] = exports.XMLToJSON(xml.childNodes[i]);
		}
	}
	
	if(xml.attributes)
		for(var i=0; i<xml.attributes.length; i++)
			result['@'+xml.attributes[i].nodeName] = xml.attributes[i].nodeValue;
	
	return result;
}
