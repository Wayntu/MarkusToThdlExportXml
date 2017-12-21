var MarkusToSTAMLFuncs = (function(){
	var metadataTable = [
		{ from: "/div[@class='doc']/@filename", to: "filename"}
	];

	var applicationTable = [
		{ from: "/div[@class='doc']/@tag", to: "tag"}
	];

	var sectionDividerTable = {
		chapter: false,
		section: "/div[@class='doc']/pre//span[@type='passage']"     // 2017-07-17: modify '/' to '//' (to handle multiple <div class="doc><pre>)
	}

	var tagTable = [
		{ type: "person", tag: "//span[@type='fullName']",
		    linkdata: [ { from: "/span/@cbdbid", to: "CbdbId"} ]},                     // 2017-03-28: change 'cbdbid' to "CbdbId"
		{ type: "person", subtype: "othername", tag: "//span[@type='partialName']",
		    linkdata: [ { from: "/span/@cbdbid", to: "CbdbId"} ]},
      { type: "person", subtype: "ddbcPerson", tag: "//span[@type='ddbcPerson']",    // 2017-03-22: Markus ���N�� tag ��J�e�m�ŧi�ϡH
		    userdata: [ { from: "/span/@ddbcperson_id", to: "note"} ]},
      { type: "location", tag: "//span[@type='placeName']",
		    userdata: [ { from: "/span/@placename_id", to: "note"} ]},                  // �S�M�N xxxx_id �����e�A��J note ��...
		{ type: "office", subtype: "officialTitle", tag: "//span[@type='officialTitle']",
		    userdata: [ { from: "/span/@officialtitle_id", to: "note"} ]},
		//{ type: "specificTerm", subtype: "specificTerm", tag: "//span[@type='specific']",
		//    userdata: [ { from: "/span/@specific_id", to: "note"} ]},
		{ type: "datetime",  tag: "//span[@type='timePeriod']",
		    userdata: [ { from: "/span/@timeperiod_id", to: "note"} ]},
		{ type: "markusDiv", subtype: "title", tag: "//div[@class='title']",
		    userdata: [ { from: "/div/@value", to: "note"} ]},    // should be no value
		{ type: "markusDiv", subtype: "fullText", tag: "//div[@class='fullText']",
		    userdata: [ { from: "/div/@value", to: "note"} ]},    // should be no value
		{ type: "markusDiv", subtype: "metadata", tag: "//div[@class='metadata']",
		    userdata: [ { from: "/div/@value", to: "note"} ]},
		//{ type: "DocTitle", tag: "//span[@type='title']" },
	   //{ type: "recipe",  tag: "//span[@type='Recipe']",
	   //   userdata: [ { from: "/span/@recipe_id", to: "note"} ]},
      //{ type: "drugname",  tag: "//span[@type='DrugName']",
      //   userdata: [ { from: "/span/@drugname_id", to: "note"} ]},
      { type: "comments", tag: "//span[@class='commentContainer']",
           userdata: [ { from: "/span/@value", to: "note"} ]}
	];

	var tagIgnore = [
		//"/span[@class='commentContainer']"
	];

	var XMLTableToJSON  = function( table ){    // [{from:xpath, to:'note'}]
      //alert(JSON.stringify(table));
		return function(context){
			var jsonData= {};
			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString(context, "text/xml");

			for( var i = 0 ; i < table.length ; i++ ){
				if( table[i].key ){
					jsonData[table[i].key] = table[i].value;
					continue;
				}
            try {             // 2017-10-26: "/span/@&#(732);drugs_id" is not a legal expression
               var nodes = xmlDoc.evaluate(table[i].from, xmlDoc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
				   jsonData[table[i].to] = [];
				   var node;
				   while( node = nodes.iterateNext() ){
				   	if( node.nodeType === 1 ){         // 1: element
				   		jsonData[table[i].to] = node.textContent;
				   	}
				   	else if( node.nodeType === 2 ){    // 2: attribute
				   		jsonData[table[i].to] = node.value.replace(/&#\((x?[0-9]+)\);/g, "&#$1;");    // 20170421: add replace()
				   	}
				   	else if( node.nodeType === 3 ){    // 3:text
				   		jsonData[table[i].to] = node.nodeValue;
				   	}
				   }
               
				   if( jsonData[table[i].to].length === 1 ){
				   	jsonData[table[i].to] = jsonData[table[i].to][0];
				   }
               
				   if( jsonData[table[i].to].length === 0 ){
				   	delete jsonData[table[i].to];
				   }
            } catch (e) {
               alert(e.message + "\n" + table[i].from);
            }
			}

			return jsonData;
		};
	}
	
	var tagTransformer = function( context ){
	   var content = [];
		var parser = new DOMParser();
		var xmlDoc = parser.parseFromString(context, "text/xml");

      // nodeType: 1 Element, 2 Attribute, 3 Text, 4 CDATASection, 5 EntityReference
      //           6 Entity, 7 ProcessingInstruction, 8 Comment, 9 Document
      //           10 DocumentType, 11 DocumentFragment, 12 Notation
		var nodes = xmlDoc.firstChild.childNodes;
		for ( var i = 0 ; i < nodes.length ; i++ ){
			if( nodes[i].nodeType === 3 ){
				content.push( nodes[i].nodeValue );
			}
			else if( nodes[i].nodeType === 1 ){
				var node = createXMLDocumentFromNode(nodes[i]);
				var ignore = false;
				for( var j = 0 ; j < tagIgnore.length ; j++ ){
					if( node.evaluate(tagIgnore[j], node, null, XPathResult.ANY_TYPE, null).iterateNext() ){
						ignore = true;
						break;
					}
				}
				if( !ignore ) {     // 2017-04-07: Tu fix (recursiveXML can return an array)
               var result = recursiveXML(node);
               if (Array.isArray(result)) {
                  content.push.apply(content, result);
               }
               else content.push( result );
            }
			}
		}

      //alert(JSON.stringify(content));
		return content;
   }
   
   // �]����S�M�ҳ]�p����Ƽҫ������A�ѡA�o�������B�z�۷�����...
   var extraTagHandling = function(node, contentList) {
      var firstChild = node.firstChild;
      var tagType = firstChild.tagName;     // �Ȯɥ��� tagName �@�� tagType...

      // 20170418
      if (tagType === 'span' && firstChild.getAttribute("class")==='commentContainer') {
         tagType = 'comment';
         // �b contentist[] �̫e���A�[�W comments ���e�]�]�N�O���A�N�����b attribute �����e�A����~���� tag �\��^
         var commentContent = firstChild.getAttribute("value");      // a JSON-format array
         var commentArray = JSON.parse(commentContent);
         if (!Array.isArray(commentArray)) return null;
         
         var commentItems = commentArray.map(function(s) {
            s = s.replace(/&#\((x?[0-9]+)\);/g, "&#$1;");
            var lines = s.split("\n");
            var category = 'default';
            if (lines[0].match(/^[A-Z0-9 ]+:?$/)) {                  // comment category
               category = lines[0].trim().replace(':','');
               lines.shift();
            }
            return { type: 'commentItem', subtype: category, content: lines.join("\n") };
         });   

         // ���ɡAcontentList �̫���G�|���Ť��e�� span??
         var myLast = contentList.pop();
         if (myLast.type === 'span' && myLast.content === '') ;       // skip this node content
         else contentList.push(myLast);
         
         if (contentList.length == 0) contentList = commentItems;
         else contentList.unshift({type:'comment', content:commentItems});
         return { type:tagType, content:contentList };
      }

      var now = {};
		for (var i = 0 ; i < tagTable.length ; i++) {
         if (tagTable[i].type != 'markusDiv') continue;
			var tags = node.evaluate( tagTable[i].tag, node, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null );
         var tag;
			while (tag = tags.iterateNext()) {
				now.type = tagTable[i].type;
				if( tagTable[i].subtype ){
					now.subtype = tagTable[i].subtype;
				}
				if( tagTable[i].userdata ){
					now.userdata = (new XMLTableToJSON(tagTable[i].userdata))((new XMLSerializer()).serializeToString(tag) );
					if( Object.keys(now.userdata).length === 0 ){
						now.userdata = undefined;
						delete now.userdata;
					}
				}
				if( tagTable[i].linkdata ){
					now.linkdata = (new XMLTableToJSON(tagTable[i].linkdata))((new XMLSerializer()).serializeToString(tag) );
					if( Object.keys(now.linkdata).length === 0 ) {
						now.linkdata = undefined;
						delete now.linkdata;
					}
				}
            ;
         }
		}
      if (Object.keys(now).length > 0) {
         now.tagType = 'markusDiv';
         now.content = contentList;
         return now;
      }
     
      return null;         
   }
      

   // �S�M�b�o�̪��B�z�覡���G���ǰ��D... 
	var recursiveXML = function( node ){
		var content = {};
		var last = content;
		var now = content;
		var allTag = 0;
		// nodeType 1:element, 2:attribute, 3:text
		//for(var child = node.childNodes[0]; child.nodeType !== 3 ; child = child.childNodes[0]){
		//for (var child = node.childNodes[0]; child && child.nodeType !== 3 ; child = child.childNodes[0]) {
		//for(var child = node.childNodes[0]; child.nodeType === 1 ; child = child.childNodes[0]){
		//	++allTag;
		//}
      var myNodes = node.getElementsByTagName("*");
      allTag = myNodes.length;
      
      if (allTag > 1) {
         var firstChild = node.firstChild;
         var tagType = firstChild.tagName;     // �Ȯɥ��� tagName �@�� tagType...
         var childNodes = firstChild.childNodes;
         var contentList = [];
         for (var i=0; i<childNodes.length; i++) {
            if (childNodes[i].nodeType == 1) {
               var myNode = createXMLDocumentFromNode(childNodes[i]);
               contentList[i] = recursiveXML(myNode);
            }
            else if (childNodes[i].nodeType == 3) {
               contentList[i] = childNodes[i].textContent;
            }
         }
         
         var ret = extraTagHandling(node, contentList);
         if (ret === null)  ret = { type: tagType, content: contentList };
 
          //alert(JSON.stringify(ret));
         return ret;
      }

		var foundTag = 0;
		for (var i = 0 ; i < tagTable.length ; i++) {
			var tags = node.evaluate( tagTable[i].tag, node, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null );
         var tag;
			while (tag = tags.iterateNext()) {
	         //alert(tag.nodeType + ':' + JSON.stringify(tag.textContent) + "\n" +
            //      tagTable[i].tag + ' ' + (new XMLSerializer()).serializeToString(tag) );
				++foundTag;
				now.type = tagTable[i].type;
				if( tagTable[i].subtype ){
					now.subtype = tagTable[i].subtype;
				}
				if( tagTable[i].userdata ){
					now.userdata = (new XMLTableToJSON(tagTable[i].userdata))((new XMLSerializer()).serializeToString(tag) );
					if( Object.keys(now.userdata).length === 0 ){
						now.userdata = undefined;
						delete now.userdata;
					}
				}
				if( tagTable[i].linkdata ){
					now.linkdata = (new XMLTableToJSON(tagTable[i].linkdata))((new XMLSerializer()).serializeToString(tag) );
					if( Object.keys(now.linkdata).length === 0 ) {
						now.linkdata = undefined;
						delete now.linkdata;
					}
				}
            
				last = now;               // referece to the previous result
				now.content = {};         // create a deeper sub-object
				now = now.content;        // move object reference to deeper sub-object 
			}
		}
      //alert(allTag + ' - Wrapup: ' + JSON.stringify(content));
		
		//console.log( content, allTag, foundTag );
		if( allTag !== foundTag ){
			var lastNode = null;
			var diff = allTag - foundTag;
			var nowFoundTag = 0;
			var child;
			// 2017-01-18: should check if child is not null (i.e., child && ...)
			for( child = node.childNodes[0] ; child && child.nodeType !== 3 ; child = child.childNodes[0]){
				for( var i = 0 ; i < tagTable.length ; i++ ){
					var tags = node.evaluate( tagTable[i].tag, child, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null );
					var tag;
					
					while( tag = tags.iterateNext() ){
						++nowFoundTag;
					}		
				}
				
				if( allTag - nowFoundTag !== diff ){
					//console.log( lastNode );
					now.type = lastNode.nodeName;
					if( lastNode.getAttribute("subtype") ){
						now.subtype = lastNode.getAttribute("subtype");
					}
					
					diff = allTag - nowFoundTag;
					
					last = now;
					now.content = {};
					now = now.content;
				}			
				lastNode = child;
				--allTag;
			}
			
			if( diff > 0 ){
				now.type = lastNode.nodeName;
				if( lastNode.getAttribute("subtype") ){
					now.subtype = lastNode.getAttribute("subtype");
				}
				
				diff = allTag - nowFoundTag;
				
				last = now;
				now.content = {};
				now = now.content;
			}
		}

		last.content = node.firstChild.textContent;
      //alert('last: ' + node.firstChild.nodeType + ': ' + JSON.stringify(last.content));
		return content;         // content and last reference to the same object!
	}
	
	var XMLtoObject = function(xmlNode){
		if( xmlNode.childNodes.length === 1 && xmlNode.firstChild.nodeType === 3 ){
			return xmlNode.firstChild.nodeValue.escape();
		}
    
    if( xmlNode.nodeType === 3 ){
      return xmlNode.nodeValue;
    }
		
		var object = [];
    var isArray = false;
		var childNodes = xmlNode.childNodes;
		for( var i = 0 ; i < childNodes.length ; ++i ){
			if( childNodes[i].nodeType === 3 ){
        isArray = true;
        object.push(childNodes[i].nodeValue);
      }
      else{
        var obj = {};
        obj[childNodes[i].nodeName] = XMLtoObject( childNodes[i] );
        object.push(obj);
      }
		}
    
    var attr = xmlNode.attributes;
    for( var i = 0 ; i < attr.length ; ++i ){
      var obj = {};
			if(attr[i].nodeName === "style" || attr[i].nodeName === "id"){
				continue;
			}
      obj[attr[i].nodeName] = attr[i].nodeValue;
      object.push(obj);
    }
    
		if( !isArray ){
      var realObj = {};
      for( var i = 0 ; i < object.length ; ++i ){
        for( var j in object[i] ){
          realObj[j] = object[i][j];
        }
      }
      object = realObj;
    }
		return object;
	}

	var generateTag = function( object ) {
		if (String.isString(object)) return object;
      if (Array.isArray(object)) {           // 2017-11-26
         var s = object.map(function(e) {
            return generateTag(e);
         });
         //return "<span class='unknown'>" + s + "</span>";
         return s;
      }
		var tag = '<span class="' ;
		var tagName, moreThanOneIdData, moreThanOneIdAttribute;
		if( object.type === "person" ){
			if( object.subtype === "othername" ){
				tagName = "partialName";
				moreThanOneIdData = "linkdata";
				moreThanOneIdAttribute = "CbdbId";       // 2017-03-28: from "cbdbid" to "CbdbId"
			}
			else if( object.subtype === "officialTitle" ){
				tagName = "officialTitle";
				moreThanOneIdData = "userdata";
				moreThanOneIdAttribute = "note";
			}
			else {
				tagName = "fullName";
				moreThanOneIdData = "linkdata";
				moreThanOneIdAttribute = "CbdbId";       // 2017-03-28: from "cbdbid" to "CbdbId"
			}
		}
		else if(object.type === "location"){
			tagName = "placeName";
			moreThanOneIdData = "userdata";
			moreThanOneIdAttribute = "note";
		}
		else if(object.type === "datetime"){
			tagName = "timePeriod";
			moreThanOneIdData = "userdata";
			moreThanOneIdAttribute = "note";
		}
		else if(object.type === "drugname"){
			tagName = "drugName";
			moreThanOneIdData = "userdata";
			moreThanOneIdAttribute = "note";
		}
		else if(object.type === "recipe"){
			tagName = "recipe";
			moreThanOneIdData = "userdata";
			moreThanOneIdAttribute = "note";
		}
		else {
		   // check if object.type is "Udef_xxx"...
		   var s = object.type;
         if (typeof(s) === 'undefined') {
            alert("Error in generateTag(): " + JSON.stringify(object));    // e.g., not an object but an array of objects: [{type,content}]
         }
		   var ret = '';
		   if (s.substr(0,5) === 'Udef_') {
            tagName = s.substr(5);
	         moreThanOneIdData = "userdata";
            moreThanOneIdAttribute = "note";
		   }
		   else {
            return "<" + object.type + ((object.subtype)? " subtype = '" + object.subtype + "'": "")+ ">" +  object.content + "</" + object.type + ">";
		   }
		}

		tag += tagName + " markup unsolved";
		if( object[moreThanOneIdData] && object[moreThanOneIdData] [moreThanOneIdAttribute] && object[moreThanOneIdData] [moreThanOneIdAttribute] .split("|").length > 1 ){
			tag += " moreThanOneId";
		}
		tag += '" type="' + tagName + '"';
		if( object.linkdata ){
			for( var key in object.linkdata ){
				if( key === "refID" ){
					continue;
				}
				tag += " " + key + '="' + object.linkdata[key] + '"';
			}
		}

		if( object.userdata ){
			for( var key in object.userdata ){
				if( key === "note" ){
					tag += " " + tagName.toLowerCase() + '_id="' + object.userdata[key] + '"'
				}
				else if( key === "refID" ){
					continue;
				}
				else {
					tag += " " + key + '="' + object.userdata[key] + '"';
				}
			}
		}

		tag += ">";
		//console.log( tag );

		if( String.isString(object.content) ){
			tag += object.content;
		}
		else {
			tag += generateTag(object.content);
		}

		tag += "</span>"

		return tag;
	}
	
	var objectToXML = function(object){
		if( String.isString(object) ){
			return object.escape();
		}
		
		if( Array.isArray(object) ){
			return object.map(objectToXML).join("");
		}
		
		var xmlString = "";
		for( var key in object ){
			if( key === "#text" ) continue;
			xmlString += "<" + key + ">" + objectToXML(object[key]) + "</" + key + ">";
		}
		return xmlString;
	}
	
	function appendCustomizedTags(customizedTags) {        // Tu
		//{ type: "recipe",  
		//  tag: "//span[@type='Recipe']",
		//  userdata: [ { from: "/span/@recipe_id", to: "note"} ]}
	   var tagHash = {};
	   for (var i=0; i<tagTable.length; i++) {
	      var type = tagTable[i].type;
         if (type === 'comments' || type === 'markusDiv') continue;
	      var tagPath = tagTable[i].tag;
	      var regex = /\/\/span\[@type='(.+)'\]/g;
         var matches = regex.exec(tagPath);
         if (matches === null) continue;          // 2017-06-08: skip if no matches found
         else {               
	         var tag = matches[1];
	         tagHash[tag] = 1;
         }
	   }
	   for (var tag in customizedTags) {           // �N Markus html �� <span type="xxx"> �ন <Udef_xxx> 
	      if (!tagHash[tag]) {
	         var tagType = 'Udef_' + tag;          // �b ThdlExportXml �����ҦW�١A�� Udef_<tag>
	         var tagPath = "//span[@type='" + tag + "']";
	         var udataFrom = "/span/@" + tag.toLowerCase() + "_id";
	         var entry = { type: tagType,
	                       tag: tagPath,
	                       userdata: [ { from: udataFrom, to: "note"} ]
	                     };
            tagTable.push(entry);
            tagHash[tag] = 1;
         }
	   }
	   //alert(JSON.stringify(tagTable));
	}

	return {
		documentInformation: function( context ){
			//var metadataTransform = XMLTableToJSON(metadataTable);
			var applicationTransform = XMLTableToJSON(applicationTable);
			var dom = tryParseXML(context);             // 2016-09-16
			if (dom === null) return null;

			metaHidden = (dom) ? dom.getElementById("metadataHidden") : null;
			//var metaHidden = (new DOMParser()).parseFromString(context, "text/xml").getElementById("metadataHidden");

			// Tu: 2017-01-19 firstChild <div ... tag="...">
         // 2017-08-09: add dom test -- otherwise it will hang
         //             �p�G�O MARKUS HTML layout �ץX�A�N�|�����D... �H��o�i��o�������ˬd
         var customizedTags = {};
         if (dom) {
            var c = dom.firstChild;
            if (c.nodeType == 1) {
               var s;
   			   customizedTags = (s = c.getAttribute("tag")) ? JSON.parse(s) : {};
            }
         }
			appendCustomizedTags(customizedTags);
			return {
				metadata: (metaHidden)? XMLtoObject(metaHidden) : {filename: (new DOMParser()).parseFromString(context, "text/xml").getElementsByClassName("doc")[0].getAttribute("filename") },
				application: applicationTransform(context),
			};
		},
      
		articleInformation: function( context ){      // get the "article" information from context (e.g., Markus html)
			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString(context, "text/xml");
			var metaHidden = xmlDoc.getElementById("metadataHidden");
			if( metaHidden ) metaHidden.parentNode.removeChild( xmlDoc.getElementById("metadataHidden") );
			var chapters = [];
			if( sectionDividerTable.chapter ){
				var nodes = xmlDoc.evaluate(sectionDividerTable.chapter, xmlDoc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
				var node;
				while( node = nodes.iterateNext() ){
					chapters.push( {type: "chapter", content: createXMLDocumentFromNode(node)} );
				}
			}
			else{
				chapters.push({type: "chapter", content: xmlDoc} );
			}

			var sections = [];
			for( var i = 0 ; i < chapters.length ; i++ ){
				sections.push({type: "chapter", content: []});
				var nodes = chapters[i].content.evaluate(sectionDividerTable.section, chapters[i].content, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);

				var node;
				if( chapters.length === 1 && (node = nodes.iterateNext()) === null ){
               // 2017-06-08: �[�W��L�u�S���p�v...
               // 2017-08-17: MARKUS �S�B�z�n�A���ɷ|����h <div class='doc'><pre>
               var variants = ["/div[@class='doc']/pre", "/div[@class='doc']/span"];
               for (var j=0; j<variants.length; j++) {
                  nodes = xmlDoc.evaluate(variants[j], xmlDoc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
                  node = nodes.iterateNext();
                  if (node !== null) break;
               }
				}

				do {
					if( node ){
						var node = (new DOMParser()).parseFromString( (new XMLSerializer()).serializeToString(node), "text/xml" );
						if( node.getElementById("metadataHidden") ) continue;
                  // node is of "Document" type (nodeType == 9)
                  var nodeXml = (new XMLSerializer()).serializeToString(node);
                  // tagTransformer �u�B�z��e tag �]�Ҧp <span type="passage" id="...">�^���U�����e�A�]�� type, id �������ݩʡA�������e���o
                  var typeValId = node.firstChild.getAttribute("id");    // �p�G passage �S�� id �ݩʡA�N�|�O null
                  //alert(typeValId);
                  var transformedContent = tagTransformer(nodeXml);    
						sections[i].content.push({ type: "section", typeValId: typeValId, content: transformedContent });
					}
				} while( node = nodes.iterateNext() );
			}

         //alert(JSON.stringify(sections));
			return sections;
		},

		mergeToContext: function( input ){
			var metadata = input.document.metadata;
			var sections = input.article;
			var application = input.document.application;

			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString( "<div class='doc'><pre></pre></div>" ,"text/xml");

			// metadata
			var rootNode = xmlDoc.evaluate("/div[@class='doc']", xmlDoc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null).iterateNext();

			var filename = xmlDoc.createAttribute("filename");
			filename.value = metadata.filename;
			rootNode.setAttributeNode(filename);

			// application
			if( application ){
					if( application.tag ){
						var tag = xmlDoc.createAttribute("tag");
						tag.value = application.tag;
						rootNode.setAttributeNode(tag);
					}
			}

			// sections
			var sectionNumber = 0;
			for( var i = 0 ; i < sections.length ; i++ ){
				for( var j = 0 ; j < sections[i].content.length ; j++, sectionNumber++ ){
					var section = '<span class="passage" type="passage" id="passage' + sectionNumber + '"><span class="commentContainer" value="[]"><span class="glyphicon glyphicon-comment" type="commentIcon" style="display:none" aria-hidden="true" data-markus-passageid="passage' + sectionNumber + '"></span></span>';
					for( var k = 0 ; k < sections[i].content[j].content.length ; k++ ){
						section += generateTag( sections[i].content[j].content[k] );
					}
					section += "</span>\n\n";
					appendAllChildren( section, xmlDoc.getElementsByTagName("div")[0].getElementsByTagName("pre")[0] );
				}
			}

			var metadataNode = xmlDoc.createElement("div");
			metadataNode.setAttribute("id", "metadataHidden");
			metadataNode.setAttribute("style", "display: none");
			//console.log(metadata);
			appendAllChildren( objectToXML(metadata), metadataNode );
			xmlDoc.getElementById("passage0").appendChild( metadataNode );

			return (new XMLSerializer()).serializeToString(xmlDoc) ;
		}
	};
})();
