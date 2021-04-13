

const log = (...args) => {
//atom.devMode &&
  console.log(...args)
};

log('test');

/** turn array into Map, for O(1) containment check - why.*/
const arrayToMap = (array) => {
  return array.reduce((acc, v) => {
    acc.set(v, true);
    return acc;
  }, new Map());
};


/** Walk up the tree. Everytime we meet a scope type, check whether we
are coming from the first (resp. last) child. If so, we are opening
(resp. closing) that scope, i.e., do not count it. Otherwise, add 1.
This is the core function.
It might make more sense to reverse the direction of this walk, i.e.,
go from root to leaf instead.

Needs to handle causes

{}
=>
{
  |
}

Want to indent not first. But first case is {} then press enter we should get
indent to level 1. Pressing enter again should leave indent at level 1 between
the brackets. Currntly not the case.

Node values are

*/
const treeWalk = (node, scopes, lastScope = null, lastNode = null) => {
  if (node == null || node.parent == null) {
    //log('parent = null or node = null', node);
    return 0;
  } else {

    let increment = 0;

    const notFirstOrLastSibling =
      (node.previousSibling != null && node.nextSibling != null );// node.nextSibling.type === 'ERROR');
    //log(node.previousSibling,node.nextSibling);

    //log('parent type', node.parent.type);
    const isScope = scopes.indent.get(node.parent.type);
    //(notFirstOrLastSibling && isScope && increment++);

    const isScope2 = scopes.indentExceptFirst.get(node.parent.type);
    //(!increment && isScope2 && node.previousSibling != null && increment++);

    const isScope3 = scopes.indentExceptFirstOrBlock.get(node.parent.type);
    //(!increment && isScope3 && node.previousSibling != null && increment++);

    log('child', node.children);
    log('last scope', lastScope);
    log('last node', lastNode)
    //log('not includes last scope', !node.children.includes(lastScope));
    //log('length', node.children.length)
    //log('length is zero', node.children.length === 0)
    const isScope4 = scopes.indent.get(node.type);
    log(node.type);
    log('isScope', isScope4);
    //log('check', (isScope4 && (!node.children.includes(lastScope))));

    //log('increment', !increment);
    // Dont think this will work.
    //|| !node.children.includes(lastScope)
    //node.children.length === 0
    if (lastNode != null) {
      //const sublist = node.children.slice(node.children.length - 1)
      //const child = node.children.find(child => lastNode.node.type = child.type && )
      log('index', (lastNode.endIndex - lastNode.startIndex > 2));
      // CurrentNode . endindex
      // Im not the last or first node
      const last = (node.lastChild != null && lastNode.type === node.lastChild.type && lastNode.text === node.lastChild.text);
      const first = (node.firstChild != null && lastNode.type === node.firstChild.type && lastNode.text === node.firstChild.text);
      // If i am the first or last you can ignore if it jumps 2 spaces not 1
      const ignoreFirst = (first && lastNode.endIndex - lastNode.startIndex > 1);
      const ignoreLast = (last && lastNode.endIndex - lastNode.startIndex > 1);

      log('not last', (!last), 'not first', (!first));
      log('ignore last', (ignoreLast), 'ignore first', (ignoreFirst));
      /*
      Indent any middle value.
      {
        |
      }
      Will not indent enter pressed after {
      Will indent enter pressed on line before }
      Will not indent enter pressed on same line as } where ending does not look like above example.
      */
      (!increment && isScope4 &&
        //((!node.children.some(child => log('SOME..', child.type, lastNode.type) && lastNode.type == child.type && lastNode.text == child.text))
        //||
        ((!first && !last && node.children.length < node.endIndex - node.startIndex)
        || (!first && ignoreLast)
        || (!last && ignoreFirst))
        //|| node.children.length == 0
        && (increment += 1));

      /*
      How to handle indentation for functional notation ?

      Plan .. indent length of name + 1 for (
      If parent is functional_notation then case found.

      If child = args -> indent.

      Has the same problem as above, does not indent start or end because there are not included in start node.
      Solution is
      If bracked and index spaceing > 1 -> indent
      That would apply to eather end. .. Or should it indent all brackeds.
      */
      log(scopes.indentExceptFirst);
      (!increment
        && node.type === 'functional_notation'
        && (lastNode.type == 'args'
          || lastNode.type == 'bracket')
        && (increment += //Math.ceil
          ((node.firstChild.text.trim().length +
          (lastNode.type == 'bracket' ? 0 : 1)) /
          (atom.config.settings.editor.tabLength ?
            atom.config.settings.editor.tabLength :
            atom.config.defaultSettings.editor.tabLength))));
        log(increment);
    }


    // apply current row, single line, type-based rules, e.g., 'else' or 'private:'
    let typeDent = 0;
    scopes.types.indent.get(node.type) && typeDent++;
    scopes.types.outdent.get(node.type) && increment && typeDent--;
    increment += typeDent;

    // check whether the last (lower) indentation happend due to a scope that
    // started on the same row and ends directly before this.
    // TODO: this currently only works for scopes that have a single-character
    // closing delimiter (like statement_blocks, but not HTML, for instance).
    if (lastScope && increment > 0 && !isScope4
      && // previous scope was a two-sided scope, reduce if starts on same row
      // and ends right before
      ((node.parent.startPosition.row == lastScope.node.startPosition.row
        && (node.parent.endIndex <= lastScope.node.endIndex + 1))
        // or this is a special scope (like if, while) and it's ends coincide
        || (isScope3 && (lastScope.node.endIndex == node.endIndex
            || node.parent.endIndex == node.endIndex) ))) {

      log('not ignoring repeat', node.parent.type, lastScope.node.type);
      increment = 0;
    } else { lastScope &&
      log(node.parent.startPosition.row,
        lastScope.node.startPosition.row,
        node.parent.endIndex,
        lastScope.node.endIndex,
        isScope3,
        node.endIndex);

    }

    log(node.text);
    log('treewalk', {node, lastScope, notFirstOrLastSibling, type: node.parent.type, increment});
    const newLastScope = (isScope || isScope2 ? {node: node.parent} : lastScope);
    //const newLastScope = node;
    return treeWalk(node.parent, scopes, newLastScope, node) + increment;
  }
};



const suggestedIndentForBufferRow = (e, scopes) => {

  log({e, scopes});

  // Given a position, walk up the syntax tree, to find the highest level
  // node that still starts here. This is to identify the column where this
  // node (e.g., an HTML closing tag) ends.
  const getHighestSyntaxNodeAtPosition = (row, column = null) => {
    if (column == null) {
      // Find the first character on the row that is not whitespace + 1
      column = e.lineTextForBufferRow(row).search(/\S/);
    }
    log('Looking...', column)
    let syntaxNode;
    //if (column >= 0) {
      log('Looking...', e.languageMode);
      syntaxNode = e.languageMode.getSyntaxNodeAtPosition({row, column});
      log({syntaxNode, text: syntaxNode.text, e});
      while (syntaxNode && syntaxNode.parent
          && syntaxNode.parent.startPosition.row == syntaxNode.startPosition.row
        && syntaxNode.parent.endPosition.row == syntaxNode.startPosition.row
        && syntaxNode.parent.startPosition.column == syntaxNode.startPosition.column
      ) {
        log('Looking....', syntaxNode);
        syntaxNode = syntaxNode.parent;
      }
      return syntaxNode;
    //}
  };

  // -----------------------------------------------------------

  /* This approach is simpler and robust against parse errors */
  return (row, tabLength, options) => {

    log({e, scopes});

    const previousRow = Math.max(row - 1, 0);
    log('previous row', previousRow);
    const previousIndentation = e.indentationForBufferRow(previousRow);
    log('previous indent', previousIndentation);
    const currentIndentation = e.indentationForBufferRow(row);
    log('current indent', currentIndentation);

    const syntaxNode = getHighestSyntaxNodeAtPosition(row);
    log('syntax..', syntaxNode);
    if (!syntaxNode) {
      return previousIndentation;
    }
    let indentation = treeWalk(syntaxNode, scopes);

    // // apply current row, single line, type-based rules, e.g., 'else' or 'private:'
    // scopes.types.indent.get(syntaxNode.type) && indentation++;
    // scopes.types.outdent.get(syntaxNode.type) && indentation--;

    // Special case for comments
    if ((syntaxNode.type == 'comment'
        || syntaxNode.type == 'description')
      && syntaxNode.startPosition.row < row
      && syntaxNode.endPosition.row > row) {
      indentation += 1;
    }

    if (options && options.preserveLeadingWhitespace) {
      indentation -= currentIndentation;
    }

    return indentation;
  };

}


// --------------------------------------------------------

const LanguageProlog = {

config: {
  'source.prolog': {
    type: 'object',
    default: {
      scopes: {
        indent: [
          'list',
          'bracketed_term',
          'curly_bracket_term',
        ],
        indentExceptFirst: [
          { type: 'operator', exact: ':-', indent: 'right'}, // indent :  left, right, all.
          { type: 'operator', exact: '->', indent: 'right'},
        ],
        indentExceptFirstOrBlock: [
        ]
      },
      types: { // for current node types, current line only
        indent: [
          //'term'
        ],
        outdent: [
          //'end'
        ]
      }
    }
  }
},

activate: function(state) {
  log('activating sanity');

  atom.config.set('core.useTreeSitterParsers', true);

  // watch editors; if new ones get added, monkey-patch them as well
  atom.workspace.observeTextEditors((e) => {
    if (e.languageMode.treeIndenter) {
      log('treeIndenter already defined; sanity already provided, skipping');
      return;
    }

    const language = e.languageMode.grammar && e.languageMode.grammar.id;
    log('language', language);
    log('config', atom.config);
    const config = atom.config.get(`language-prolog-treesitter.${language}`);
    if (config && e.languageMode.getSyntaxNodeAtPosition) {
      // turn into Maps
      const scopes = {
        indent: arrayToMap(config.scopes.indent),
        indentExceptFirst: arrayToMap(config.scopes.indentExceptFirst || []),
        indentExceptFirstOrBlock: arrayToMap(config.scopes.indentExceptFirstOrBlock || []),
        types: {
          indent: arrayToMap(config.types && config.types.indent || []),
          outdent: arrayToMap(config.types && config.types.outdent || [])
        }
      }

      e.languageMode.suggestedIndentForBufferRow =
        suggestedIndentForBufferRow(e, scopes);
    } else {
      log(`no grammar defined for ${language} or e.languageMode.getSyntaxNodeAtPosition not defined, leaving atom.io's indentation logic in place`);
    }

  });
},

deactivate: function() {
  log('back to insanity');
},

};


module.exports = LanguageProlog;
