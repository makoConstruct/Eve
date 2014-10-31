var initialValue =  "* time\n  ~ time\n\n* refresh\n  ~ tick startTime endTime flowIx\n\n* edge\n  ~ from to\n  + \"a\" \"b\"\n  + \"b\" \"c\"\n\n* path\n  | edge from to\n\n* path2\n  | edge from to:t\n  | path from:t to\n\n* path\n  | path2 from to";

if(window.localStorage["eveEditorCode"]) {
  initialValue = window.localStorage["eveEditorCode"];
}

CodeMirror.defineMode("eve", CodeMirrorModeParser);
CodeMirror.defineMIME("text/x-eve", "eve");

var editor = CodeMirror(document.querySelector("#editor"), {
  value: initialValue,
  tabSize: 2,
  mode:  "eve"
});

var editorApp;
var editorProg;
var worker = new Worker("../src/worker.js");

function tableCard(name, headers, rows, constants) {
  var card = $("<div class='card table-card'><h2></h2><div class='grid'><div class='grid-header'></div></div></div>");
  var grid = $(".grid", card);
  var gridHeader = $(".grid-header", card);
  $("h2", card).html(name);
  for(var headerIx = headers.length - 1; headerIx >= 0; headerIx--) {
    var header = headers[headerIx];
    gridHeader.append("<div class='header'>" + header + "</div>");
  }
  for(var cons in constants) {
    gridHeader.append("<div class='header'>" + constants[cons].name + "</div>");
  }
  for(var ix = rows.length - 1; ix >= 0; ix--) {
    var row = rows[ix];
    var rowElem = $("<div class='grid-row'></div>");
    for(var field in row) {
      rowElem.append("<div>" + row[field] + "</div>")
    }
    for(var cons in constants) {
      rowElem.append("<div>" + constants[cons].constant + "</div>");
    }
    grid.append(rowElem);
  }
  return card.get(0);
}

function onTableCards(cards) {
  var start = now();
  $(".table-card").remove();
  var frag = document.createDocumentFragment();
  for(var cardIx = cards.length - 1; cardIx >= 0; cardIx--) {
    var card = cards[cardIx];
    frag.appendChild(tableCard(card[0], card[1], card[2], card[3]));
  }
  $("#cards").append(frag);
  $("#renderStat").html((now() - start).toFixed(2));
}

function clearErrors(errors) {
  $("#errors").empty().hide();
}

function clearUICard(errors) {
  $("#uiCard").empty();
}

function addErrors(errors) {
  for(var i in errors) {
    var err = errors[i];
    if(typeof err === "string") {
      $("#errors").append("<li>" + err + "</li>");
    } else {
      $("#errors").append("<li> Line: " + (err.line + 1) + " - " + err.message + "</li>");
    }
  }
  $("#errors").show();
}

function onChange(cm, change) {
  var edValue = cm.getValue();
  window.localStorage["eveEditorCode"] = edValue;
  worker.postMessage({type: "compile", code: edValue});
}


function uiDiffRenderer(diff, storage) {
  var elem_id = 0;
  var elem_type = 1;

  var text_text = 1;

  var attrs_attr = 1;
  var attrs_value = 2;

  var styles_attr = 1;
  var styles_value = 2;

  var events_event = 1;
  var events_label = 2;
  var events_key = 3;

  var child_childid = 2;

  var builtEls = storage["builtEls"] || {"root": document.createElement("div")};
  var handlers = storage["handlers"] || {};
  var roots = {};
  var removed = {};

  //add subProgram elements
  for(var i in compiledSystems) {
    builtEls[i + "_root"] = compiledSystems[i].getUIRoot();
  }

  //capture the elements we will remove
  var remElem = diff["uiElem"].removes;
  var remElemsLen = remElem.length;
  for(var i = 0; i < remElemsLen; i++) {
    var cur = remElem[i];
    var me = builtEls[cur[elem_id]];
    removed[cur[elem_id]] = me;
  }

  //add elements
  var elem = diff["uiElem"].adds;
  var elemsLen = elem.length;
  for(var i = 0; i < elemsLen; i++) {
    var cur = elem[i];
    if(!svgs[cur[elem_type]]) {
      var tag = cur[elem_type] || "span";
      var me = builtEls[cur[elem_id]] = document.createElement(tag);
    } else {
      var me = builtEls[cur[elem_id]] = document.createElementNS("http://www.w3.org/2000/svg", cur[elem_type]);
    }

    var old = removed[cur[elem_id]];
    if(old)  {
      if(old && old.parentNode && old.parentNode.parentNode) {
        old.parentNode.insertBefore(me, old);
        old.parentNode.removeChild(old);
      }
      while(old.childNodes.length) {
        me.appendChild(old.childNodes[0]);
      }

      //TODO: transfer attrs
      //TODO: transfer handlers
//       handlers[cur[elem_id]] = null;
      removed[cur[elem_id]] = null;
    }
  }

  //remove all elements that weren't just added
  for(var toRemove in removed) {
    var cur = removed[toRemove];
    if(!cur) continue;

    if(cur && cur.parentNode && cur.parentNode.parentNode) {
      cur.parentNode.removeChild(cur);
    }
    handlers[toRemove] = null;
    builtEls[toRemove] = null;
    removed[toRemove] = null;
  }

  //add text
  var text = diff["uiText"].adds;
  var textLen = text.length;
  var addedText = {};
  for(var i = 0; i < textLen; i++) {
    var cur = text[i];
    if(!builtEls[cur[elem_id]]) {
      builtEls[cur[elem_id]] = document.createTextNode(cur[text_text]);
    } else {
      builtEls[cur[elem_id]].nodeValue = cur[text_text];
    }
    addedText[cur[elem_id]] = true;
  }

  //remove text
  var text = diff["uiText"].removes;
  var textLen = text.length;
  for(var i = 0; i < textLen; i++) {
    var cur = text[i];
    var me = builtEls[cur[elem_id]];
    if(me && !addedText[cur[elem_id]]) {
      me.nodeValue = "";
      builtEls[cur[elem_id]] = null;
    }
  }

  var attrs = diff["uiAttr"].adds;
  var attrsLen = attrs.length;
  for(var i = 0; i < attrsLen; i++) {
    var cur = attrs[i];
    builtEls[cur[elem_id]].setAttribute(cur[attrs_attr], cur[attrs_value]);
  }

  var styles = diff["uiStyle"].adds;
  var stylesLen = styles.length;
  for(var i = 0; i < stylesLen; i++) {
    var cur = styles[i];
    builtEls[cur[elem_id]].style[cur[styles_attr]] = cur[styles_value];
  }

  //Remove events
  var events = diff["uiEvent"].removes;
  var eventsLen = events.length;
  for(var i = 0; i < eventsLen; i++) {
    var cur = events[i];
    if(builtEls[cur[elem_id]] && handlers[cur[elem_id]] && handlers[cur[elem_id]][cur[events_event]]) {
      var handler = handlers[cur[elem_id]][cur[events_event]];
      builtEls[cur[elem_id]].removeEventListener(cur[events_event], handler);
      handlers[cur[elem_id]][cur[events_event]] = null;
    }
  }

  var events = diff["uiEvent"].adds;
  var eventsLen = events.length;
  for(var i = 0; i < eventsLen; i++) {
    var cur = events[i];
    if(!handlers[cur[elem_id]]) {
      handlers[cur[elem_id]] = {};
    }
    //var handler = handlers[cur[elem_id]][cur[events_event]] = createUICallback(application, cur[elem_id], cur[events_event], cur[events_label], cur[events_key]);
    //TODO: hook up event handlers
    var handler = function() {};
    builtEls[cur[elem_id]].addEventListener(cur[events_event], handler);
  }

  var children = diff["uiChild"].adds;
  var childrenLen = children.length;
  children.sort(function(a,b) {
    if(a[0] !== b[0]) {
      return a[0].localeCompare(b[0]);
    } else {
      if(typeof a[1] === "string" || typeof b[1] === "string") {
        return (a[1] + "").localeCompare((b[1] + ""));
      } else {
        return a[1] - b[1];
      }
    }
  });
  for(var i = 0; i < childrenLen; i++) {
    var cur = children[i];
    var child = builtEls[cur[child_childid]];
    var parent = builtEls[cur[elem_id]];
    if(cur[elem_id] == "subProgramUI") {
    }
    if(parent && child) {
      parent.appendChild(child);
    }
  }

  if(!storage["builtEls"]) {
    storage["builtEls"] = builtEls;
    storage["handlers"] = handlers;
    if(storage["rootParent"]) {
      storage["rootParent"].appendChild(builtEls["root"]);
    }
  }


};

var storage = {};

worker.onmessage = function(event) {
  switch(event.data.type) {
    case "tableCards":
      clearErrors();
      onTableCards(event.data.cards);
      break;
    case "log":
      event.data.args.unshift("Worker: ");
      console.log.apply(console, event.data.args);
      break;
    case "error":
      addErrors([event.data.error])
      console.error(event.data.error);
      break;
    case "errors":
      addErrors(event.data.errors);
      console.error("Syntax error: ", event.data.errors);
      break;
    case "runStats":
      $("#timeStat").html(event.data.runtime);
      $("#factsStat").html(event.data.numFacts);
      break;
    case "renderUI":
      storage["rootParent"] = $("#uiCard").get(0);
      uiDiffRenderer(event.data.diff, storage);
      break;
  }
}

editor.on("change", Cowboy.debounce(200, onChange));
onChange(editor, null);
