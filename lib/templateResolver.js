var fs = require("file");
var templateDir = (require("commonjs-utils/settings").templateFolder || "templates/");
var templateExtension = (require("commonjs-utils/settings").templateExtension || ".html");

exports.get = function(name){
        var nameParts = name.split("/");
        var templateName = templateDir + name;


        if (fs.isDirectory(templateName) && !fs.isFile(templateName+templateExtension)){
                templateName = templateName + "/" + nameParts[nameParts.length-1] + templateExtension;
        }else{
                templateName = templateName + templateExtension;
        }

        if (fs.isFile(templateName)){
                return fs.read(templateName);
        }else{
                var ending = nameParts.pop();
                templateName = templateDir + nameParts.join("/");
                if (fs.isDirectory(templateName)) {
                        templateName = templateName +"/"+ nameParts[nameParts.length-1] + templateExtension;
                        if (fs.isFile(templateName)){
                                return readFile(templateName);
                        }
                }else{
                        //twice we popped one off above
                        nameParts.push(ending);
                        nameParts.push(ending);
                }
        }

        var found=false;
        while(nameParts.length>0){
                var templateName = templateDir + nameParts.join("/") + templateExtension;
                if (fs.isFile(templateName)){
                        return fs.read(templateName);
                }
                nameParts.pop();
        }
};

