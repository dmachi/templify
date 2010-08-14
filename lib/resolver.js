/**
 * A very simple filesystem based storage 
 */
var when = require("promised-io/promise").when;
	
/**
//given a template store and an id (should we pass object here too?), determine and retrieve the optimal
//template.  If the optional exact parameter is supplied, retrieve this template specifically by id and don't
//follow any selectional algorithms.
//
// The Selection algo here simply strips off the last id element on each pass, returning the first found.
// for example, searching /foo/bar/baz,/foo/bar,/foo and returning the first one found.
**/

exports.Resolver = function(store,options) {
	//print("Setup Resolver: " + store);
	var defaultTemplate = require("commonjs-utils/settings").defaultTemplate || "default"
	return function(id,exact){
		print("Resolve Template for ID: " + id);
		var template,
			parts=id.split("/");
		while(parts.length>0){
			var tid = parts.join("/");
			var templateString="";
			//print("getFrom Store");
			template = store.get(tid);
			if (template){
				print("Found Template: " + tid);
				template.forEach(function(c){templateString+=c.decodeToString()});
				return templateString;
			}

			if (exact){return}
			
			parts.pop();
		}

		//attempt to load the default template
		template = store.get(defaultTemplate);
		if (template){
			template.forEach(function(c){templateString+=c.decodeToString()});
			return templateString;
		}

		//no default template give a really basic default
		return "<html><body>{{$data}}<body></html>";
	}
}

