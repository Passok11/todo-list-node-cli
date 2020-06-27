const readline = require('readline');
const fs = require('fs');
const sleep = require('util').promisify(setTimeout);

//
// Initialize
//

// const indexConsole = 20;

// Colors method for colorize terminal output
const res = '\x1b[0m';
const colors = {
  /*cyan: m => {
    return `\x1b[36m${m + res}`;
  },*/
  white: m => {
    return `\x1b[90m${m + res}`;
  },
  bwhite: m => {
    return `\x1b[1m${m + res}`;
  },
  inverse: m => {
    return `\x1b[7m${m + res}`;
  },
  underline: m => {
    return `\x1b[4m${m + res}`;
  }
}

// To get commands and ouputs
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Redefines console.clear for better output (windows and linux)
console.clear = () => {
  process.stdout.write("\u001b[2J\u001b[0;0H");
  return process.stdout.write('\033c\033[3J');
};



// todos = file of todos
// redos = file of redos
// groups = array with the name of all groups
// actualName = current id of the group
// actualGroup = all the current todos of the actual group
let OTODOS, todos, groups, actualGroup, actualName;

// Start the program
const start = () => {
  console.clear();
  OTODOS, todos, groups, actualGroup, actualName = undefined;
  loadFile();
}


// CONST FUNCTIONS = Program functions
// NORMAL FUNCTIONS = Commands functions

//
// Methods and functions
//

// Group Functions

// show group to see now
function showGroup(wanted) {
  if (wanted.length > 0) {
    groups.forEach((group, i) => {
      if (wanted === group) actualName = i;
    });
  }
}

// tab to next group
function tabGroup() {
  if (groups.length > 1) {
    if (groups.length - 1 === actualName) actualName = 0;
    else actualName++;
    // reload actual group
    actualGroup = todos[groups[actualName]];
  }
}

async function nameGroup(args) {
  // must be only two args
  if (args.length === 2) {
    const NAME = args[0];
    const WANTED = args[1];

    try {
      if (todos[WANTED])
        throw 'You have to chose a name that isn\' taken.';

      else if (todos[NAME]) {
        todos[WANTED] = todos[NAME];
        // select the new group
        // > groups list
        actualName = groups.length - 1;
        // > todos list
        actualGroup = todos[WANTED];

        // delete old group
        delete todos[NAME];
      }

      else
        throw 'Please, chose a group that exists.';
        
    }
    catch (e) {
      await alertError(false, e);
    }
  }
}


function removeGroup(args) {
  // must be only one arg
  if (args.length === 1 && groups.length > 1) {
    try {


      switch (args[0]) {
        // if it's the first group then just back to normal
        case groups[0]:
          actualName = 0;
          break;

        // verify if there's the same group 
        // that is being used right now
        case groups[actualName]:
          actualName = actualName - 1;
          break;

        // does nothing if you are not
        // removing a group that is
        // being used
        default: 
      }

      // delete group
      delete todos[args[0]];

    }
    catch (e) {
      console.log("An error occured trying to remove this group.", e);
      process.exit();
    }
  }
}

function addGroup(args) {
  // must be only one arg
  if (args.length === 1) {
    todos[args[0]] = [];
  }
}

function checkGroup(args) {
  if (args.length === 1) {
    showGroup(args[0]);
    checkTodos([`0-${actualGroup.length}`]);
  }
}

// Todos Functions

// retrieve index of an number argument
const getIndex = (text) => {
  const patt = /^-\d+\b|-\d/;
  const lastWord = text[text.length - 1];
  let index;
  if (patt.test(text[0])) {
    index = text[0];
    text.splice(0, 1);
  }
  else if (patt.test(lastWord)) {
    index = lastWord;
    text.splice(text.length - 1, 1);
  }
  // returns if there is no index
  else return 1;
  // remove minus
  index = parseInt(index.replace('-', ''));
  // if returns that the number return is not in the rules
  if (index > actualGroup.length - 1 || index < 0) return 2;
  return {
     text: text.join(' '),
     index,
  };
}

// add normally in todos files (by pushing)
function addNormalTodo(text) {
  actualGroup.push({
    isChecked: false,
    text,
    lastActivity: '>',
    lastUpdated: Date.now(),
  });
}

// Timed Todos Functions

// parse minutes and index for a timed todo
const parseMinutesIndex = (args) => {
  const textJ = args;
  let time;
  // pattern for number with minus as prefix
  const patt = /^-\d+\b|-\d/;
  let index, minutes, text;
  let lastArg = textJ[textJ.length - 1];
  let penultArg = textJ[textJ.length - 2];
  // if the input is like (at todo -minutes)
  if (patt.test(lastArg) && patt.test(penultArg) === false && patt.test(args[0]) === false) {
    // parse as normal number for index
    minutes = parseInt(lastArg.replace('-', ''));
    // remove minutes of the text
    textJ.splice(textJ.length - 1, 1);
  }
  // if the input is like (at -minutes todo)
  else if (patt.test(args[0]) && patt.test(lastArg) === false) {
    // parse as normal number for index
    minutes = parseInt(args[0].replace('-', ''));
    // remove minutes of the text
    textJ.splice(0, 1);
  }
  // if the input is like (at todo -minutes -index) then
  else if (patt.test(penultArg) && patt.test(lastArg)) {
    // parse as normal number for minutes
    penultArg = parseInt(penultArg.replace('-', ''));
    // convert minutes to miliseconds
    minutes = penultArg;
    // parse as normal number for index
    index = parseInt(lastArg.replace('-', ''));
    // if index is invalidate
    if (index < 0 || index > actualGroup.length - 1) return 1;
    // remove index and minutes of the text
    textJ.splice(textJ.length - 2, 1);
    textJ.splice(textJ.length - 1, 1);
  }
  // or if the input is like (at -minutes todo -index)
  else if (patt.test(args[0]) && patt.test(lastArg)) {
    // parse as normal number for minutes and convert it to miliseconds
    minutes = parseInt(args[0].replace('-', ''));
    // parse as normal number for index
    index = parseInt(lastArg.replace('-', ''));
    // if index is invalidate
    if (index < 0 || index > actualGroup.length - 1) return 1;
    // remove index and minutes of the text
    textJ.shift();
    textJ.splice(textJ.length - 1, 1);
  };
  text = textJ.join(' ');
  minutes = minutes * 60000;
  return { text, index, minutes };
} 

// Add todo to be repeated
function addTodoTimed(args) {
  if (args.length > 1) {
    // validate the args with every unique possibility
    const validate = parseMinutesIndex(args);
    // if index is invalidate returns nothing
    if (validate === 1) return false; 
    // if has index then add with index
    if (validate.index !== undefined && validate.minutes && validate.text) {
      const dateNow = Date.now();
      actualGroup.splice(validate.index, 0, {
        isChecked: false,
        text: validate.text,
        lastActivity: '>',
        repeatTime: validate.minutes,
        lastRepeated: dateNow,
        lastUpdated: dateNow,
      });
    }
    // if just has minutes and text then add
    else if (validate.text && validate.minutes) {
      const dateNow = Date.now();
      actualGroup.push({
        isChecked: false,
        text: validate.text,
        lastActivity: '>',
        repeatTime: validate.minutes,
        lastRepeated: dateNow,
        lastUpdated: dateNow,
      });
    }
  }
  // command output:
  // NORMAL
  // at todo -minutes
  // at -minutes todo
  // at todo -minutes -index
  // at -minutes todo -index
  // NEVER
  // at -index todo          => at -minutes todo
  // at todo -index          => at todo -minutes
  // at -index todo -minutes => at -minutes todo -index
  // at todo                 => nothing
}

// Edit the old time of the loopable todo to a new one
function editTimed(args) {
  // always two args (first: todo; second: time in minutes)
  if (args.length === 2) {
    // need always be a number
    if (/[^\d+]/.test(args[0])) return false;
    // if the number is bigger or lower than expected
    if (args[0] < 0 || args[0] > actualGroup.length - 1) return false;
    // make todo easier for code
    const todo = actualGroup[args[0]];
    // if todo is loopabe
    const loopable = todo.repeatTime;
    // change repeat Time to the new
    if (loopable) {
      // convert to miliseconds
      const newTime = args[1] * 60000;
      // change the old time to the new one
      todo.repeatTime = newTime;
    }
  }
}

// Test todos if their time already passed
const testTodos = () => {
  // verify each todo in the actual group
  actualGroup.forEach(todo => {
    // if todo is loopable
    const loopable = todo.repeatTime;
    if (loopable) {
      const dateNow = Date.now();
      const lastTimeTodo = todo.lastRepeated + todo.repeatTime;
      // if that already passed then resets it
      if (dateNow >= lastTimeTodo) {
        todo.lastActivity = '>';
        todo.isChecked = false;
        todo.lastRepeated = dateNow;
        todo.lastUpdated = dateNow;
      }
    }
  });
}

const alertError = async (type, message) => {
  // types
  // false = warning  = warn user to use correctly 
  // true  = error    = break program

  let out = type ? 'CRITICAL' : 'WARNING';

  // prettier type with terminal size
  while (out.length < process.stdout.columns)
    out = out + ' ';

  console.clear();

  // top bar
  console.log(colors.inverse(out) + '\n');

  console.log(message + '\n');

  console.log(colors.inverse(out) + '\n');

  // 1.5 segunds timeout
  await sleep(1500);

  return;
  
}

const testSeparator = (type, index) => {
  // if exists index
  if (typeof index === 'number') {
    switch (type) {
      case 'line':
      case 'l':
        actualGroup.splice(index, 0, {
          separator: true,
          text: '-'
        });
        break;
      case 'transparent':
      case 'tr':
        actualGroup.splice(index, 0, {
          separator: true,
          text: ' '
        });
        break;
      default:
        actualGroup.splice(index, 0, {
          separator: true,
          text: type
      });
    }
  } else {
    switch (type) {
      case 'line':
      case 'l':
        actualGroup.push({
          separator: true,
          text: '-'
        });
        break;
      case 'transparent':
      case 'tr':
        actualGroup.push({
          separator: true,
          text: ' '
        });
        break;
      default:
        actualGroup.push({
          separator: true,
          text: type
        });
    }
  }
}

// People now doesn't care more about getting
// offended, they are just searching something that
// they can be offended.
// Normal Todos Functions

// Add separator todo in todos files
function addSeparator(text) {
  if (text.length === 1) {
    // if the type doesn't have anything at
    // all just reload
    if (text[0].length === 0) return;
    // ...
    return testSeparator(text[0]);

  } else if (text.length >= 2) {
    const validate = getIndex(text);

    if (typeof validate.index === 'number')
      return testSeparator(validate.text, validate.index);

    else return testSeparator(text.join(' '));
  }
  else {  
    return actualGroup.push({
      separator: true,
      text: '-'
    });
  };
}

// Add todo in todos files (command check and index) 
function addTodo(text) {
  if (text.length > 0) {
    // parse text and return index if theres any
    const validate = getIndex(text);
    switch (validate) {
      case 1: // if returns that there is no index
      case 2: // if returns that the given index is not in the rules
              // (bigger than actual length of the group)
        return addNormalTodo(text.join(' '));
        break;
      default:
        actualGroup.splice(validate.index, 0, {
          isChecked: false,
          text: validate.text,
          lastActivity: '>',
          lastUpdated: Date.now(),
        });
    };
  }
}

// Edit todo method
function editTodo(text) {
  if (text.length > 0) {
    // parse text and return index if theres any
    const validate = getIndex(text);
    // if returns that there is no index
    if (validate === 1) return addNormalTodo(text.join(' '));
    // if returns that the number return is not in the rules
    else if (validate === 2) return;
    actualGroup[validate.index].text = validate.text;
  }
}

// Verify two numbers in a method that reads two numbers and returns true if everything is okay :3 
function verifyTwoNumbers(args) {
  // always need two arguments
  if (args.length !== 2) return false;
  for (item of args) {
    // need always be a number
    if (/[^\d+]/.test(item)) return false;
    // if the number is bigger or lower than expected
    if (item < 0 || item > actualGroup.length - 1) return false;
  }
  return true;
}

// Returns an array with the min value first and the max value at the end
function organizeTwoNumbers(args) {
  // parse to numbers
  const first = parseInt(args[0]);
  const second = parseInt(args[1]);
  // if the end is lower than the start switch and then return their values
  if (second < first) return [second, first];
  else return [first, second];
}

// Switch todo
function switchTodo(args) {
  // this does not have a default position, it's forced two arguments!!!
  // because for switching you must be careful
  // verify both numbers
  if (verifyTwoNumbers(args) === false) return;
  args = organizeTwoNumbers(args);
  if (args[0] === args[1]) return;
  // first todo you want to switch
  moveTodo([args[0], args[1]]);
  // verify if they are next on other, if so, then just move one is enough...
  if (args[1] - 1 < 0) args[1] = 0;
  if (args[1] - 1 !== args[0]) moveTodo([args[1] - 1, args[0]]); 
}

// Copy a todo to another place
function copyTodo(args) {
  // if theres only the todo you want to move then default position to move is the last one
  if (args.length === 1) args.push(actualGroup.length);
  // verify both numbers
  if (verifyTwoNumbers(args) === false) return;
  // first is the todo you want to copy
  const todo = actualGroup[args[0]];
  // second the index you want to put
  const index = args[1];
  // copy it
  actualGroup.splice(index, 0, todo); 
}

function moveTodo(args) {
  // if theres only the todo you want to move then default position to move is the last one
  if (args.length === 1) args.push(actualGroup.length);
  // verify both numbers
  if (verifyTwoNumbers(args) === false) return;
  // first is the todo you want to move
  const todo = actualGroup[args[0]];
  // second the index you want to put
  const index = args[1];
  // remove the current todo of the todos.json
  actualGroup.splice(args[0], 1);
  // move it
  actualGroup.splice(index, 0, todo); 
}

// Range In between two numbers and return their indexes
function rangeIn(ids) {
  ids = [ids];
  let [start, end] = ids[0].split('-');
  // if the index given is bigger than how much you have
  if (start > actualGroup.length || actualGroup.length < end) return;
  if (start < 0 && end < 0 ) return;
  const args = organizeTwoNumbers([start, end]);
  let validate = [];
  for (let i = args[0]; i <= args[1]; i++) validate.push(i.toString());
  return validate;
}

function checkTodos(ids) {
  // verify if there's any item with range in
  ids.forEach((id, index) => {
    id = id.toString();
    // 13-45 match
    if (/\d+-\d+/g.test(id)) {
      // range the item
      const validate = rangeIn(id);
      // remove range item
      ids.splice(index, 1);
      // add ranged items
      ids = ids.concat(validate);
    };
  });
  // loop for change each id
  ids.forEach(id => {
    if (actualGroup[id] && !actualGroup[id].separator) {
      const ischecked = !actualGroup[id].isChecked;
      actualGroup[id].isChecked = ischecked;
      actualGroup[id].lastActivity = ischecked ? '»' : '>';
      actualGroup[id].lastUpdated = Date.now();
    }
  });
}

function removeTodos(ids) {
  if (ids.length === 0) return;
  // verify if there's any item with range in
  ids.forEach((item, index) => {
    item = item.toString();
    if (/[a-zA-Z]/g.test(item)) return;
    // 13-45 match
    if (/\d+-\d+/g.test(item)) {
      // range the item
      const validate = rangeIn(item);
      // remove range item
      ids.splice(index, 1);
      // add ranged items
      ids = ids.concat(validate);
    };
  });
  ids.sort((a, b) => b - a);
  ids.forEach(id => {
    id = parseInt(id);
    if (actualGroup[id]) actualGroup.splice(id, 1);
  });
}

// Copy to clipboard method
function getCopy(ids) {
  if (ids.length === 0) return;
  if (actualGroup[ids[0]]) {
    let data = actualGroup[ids[0]].text;
    switch (process.platform) {
      case 'linux':
        require('child_process').exec(`echo -n "${data}" | xclip -sel clip`);
        break;
      case 'win32':
          proc = require('child_process').spawn('clip'); 
          proc.stdin.write(data);
          proc.stdin.end();
        break;
      case 'darwin':
        require('child_process').exec(`echo ${data} | pbcopy`);
        break;
      default:
        //console.log('Please report the OS you use in the our repository! > (Koetemagie/todoncli)')
    }
  };
};

// Delete all the checked todos
function remCheckedTodos() {
  let ids = actualGroup.map((item, index) => {
    if (item.isChecked === true) return index;
  });
  ids = ids.filter(item => item !== undefined);
  removeTodos(ids);
}


//
// Predefined Outputs
//

const roundIt = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Format todo time for showTodos function
const formatTodoTime = (time, repeatTime, lastRepeated) => {
  let output;
  if (repeatTime === undefined) {
    const date = new Date(time);
    // make date prettier
    let specials = [date.getDate(), (date.getMonth() + 1), date.getHours(), date.getMinutes()];
    specials = specials.map(item => {
      item = item.toString();
      while (item.length <= 1) item = `0${item}`;
      return item;
    });
    output = `${specials[0]}/${specials[1]}/${date.getFullYear()} ${specials[2]}:${specials[3]}`;
  }
  else {
    const now = Date.now();
    let time = ((repeatTime + lastRepeated) - now) / 60000;
    if (time > 60 && time < 1440)
      time = `-${roundIt(time / 60)}h`;    // Hours
    else if (time > 1440 && time < 10080)
      time = `-${roundIt(time / 1440)}d`;  // Days
    else if (time > 10080 && time < 43800)
      time = `-${roundIt(time / 10080)}w`; // Weeks
    else if (time > 43800)
      time = `-${roundIt(time / 43800)}m`; // Months
    output = time;
  }
  // make output prettier
  while (output.length < 16) output = ` ${output}`;
  return output;
}

// Show documentation
function showHelp() {
  const HELP_ALL_COMMANDS = [
    [ ['add', 'a'],
      'Add a new todo. Default is in the main list, if you want to add in a index then add in the end the index number with minus   prefix.',
      'add my new task',
    ],
    [ ['check', 'x'],
      'Checkmark the items. This will check the first item and the third. If you want to check only one, then just type the index.',
      'check 0 2',
    ],
    [ ['edit', 'ed'],
      'This will replace the indexed to-do to another. Same usage of add command.',
      'edit this one is the new -5',
    ],
    [ ['switch', 's'],
      'This will switch the indexed to-do to another. There is no default!',
      'switch 1 5',
    ], 
    [ ['copy', 'c'],
      'This will copy the indexed to-do to other position. Default position is the last.',
      'copy 2 4',
    ], 
    [ ['move', 'm'],
      'This will move the indexed to-do to other position.',
      'move 9 6',
    ], 
    [ ['rem', 'r'],
      'This will remove the selected to-do. If you want to remove more, just separate the arguments with spaces.',
      'rem 0 1',
    ],
    [ ['get', 'g'],
      'This will copy to clipboard the indexed todo.',
      'get 5',
    ],
    [ ['remcheckeds', 'rc'],
      'This will remove all the the checked to-dos.',
      'remcheckeds',
    ],
    [ ['help', 'h'],
      'Show this. Duh :3',
      'help',
    ],
    [ ['license', 'l'],
      'Show the license of the software.',
      'license',
    ],
    [ ['remcheckeds', 'rc'],
      'Remove the checkeds to-dos.',
      'remcheckeds',
    ],
    [ ['addgroup', 'ag'],
      'Create a new group of to-dos. This helps you to organize better the types of to-dos you have.',
      'addgroup NewWorld',
    ],
    [ ['showgroup', 'sg'],
      'Show the selected group.',
      'showgroup VidaLouca',
    ],
    [ ['remgroup', 'rg'],
      'Delete the selected group.',
      'remgroup NewWorld',
    ],
    [ ['checkgroup', 'cg'],
      'Check the todos of the selected group.',
      'checkgroup NewWorld',
    ],
    [ ['namegroup', 'ng'],
      'Name the selected group. First is the group you want to rename and then the name you want.',
      'namegroup NewWorld VidaLouca',
    ],
    [ ['edittime', 'et'],
      'Edit the time of the selected todo to a new one. In example change the time of 5th todo to 60 minutes.',
      'et 5 60',
    ],
    [ ['addseparator', 'as'],
      'Add a line to separate todos in a group. You can use them as titles or just white spaces.',
      'as -0 New Title',
    ],
    [ ['addtime', 'at'],
      'Add a todo which will loop in a certain time.',
      'addtime Do this every hour -60',
    ],
    [ ['tab', 't'],
      'Show next group.',
      'tab',
    ],
    [ ['restart', 'rs'],
      'Restart the program. :|',
      'restart',
    ],
    [ ['exit', 'e'],
      'Exit the program. :|',
      'exit',
    ],
  ];

  let VERSION = '2.0';
  const NAME = 'TodoNcli (^o^)/';
  const SYNOPSIS = 'Manage your todos anytime using command line!\r\nEvery change will be saved in your drive.';
  const USAGE = `Usage: ${colors.inverse('command [arguments]')} - the arguments are space separated!`;
  const LEAVE = 'To leave, just press anything!';

  const TWO_BWHITE_LENGTH = `${colors.inverse('')}`.length
                          + `${colors.inverse('')}`.length;

  // put version in the right
  while (VERSION.length < process.stdout.columns - NAME.length)
    VERSION = ' ' + VERSION;

  console.log(NAME + VERSION + '\n');
  console.log(SYNOPSIS + '\n' + USAGE + '\n' + LEAVE + '\n');

  HELP_ALL_COMMANDS.forEach(ITEM => {
    const COMMANDS = ITEM[0];
    const EXPLANATION = ITEM[1];
    let example = ITEM[2];

    const COMMANDS_OUTPUT = `${colors.bwhite(COMMANDS[0])} or ${colors.bwhite(COMMANDS[1])}`;

    // 0X0001 please see "const topBarTodos = ()"'s comments for the explanation
    // put example in right
    while (example.length < (process.stdout.columns
                             - COMMANDS_OUTPUT.length + TWO_BWHITE_LENGTH) )
           example = ' ' + example;

    console.log(COMMANDS_OUTPUT + example);

    return console.log(EXPLANATION + '\n');

  });

}

// Show the license :|
function showLicense() {
  return console.log(`
  todoncli

  Copyright © 2020-2020 Koetemagie
  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without │ restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 `);
}

// ???
function showProtec() {
  console.log(`
 ┌───────────────────────────────────────────────────────────────────────────┐
 │    -=-                                                                    │
 │ (\\  _  /)                                    The Angel will protec you!   │
 │ ( \\( )/ )                                                :Z               │
 │ (       )                                                                 │
 │  \`>   <´                                                                  │
 │  /     \\                                                                  │
 │  \`-._.-´         fgpfy vjlqb jqihl acuan zogf                             │
 │                                                                           │
 └───────────────────────────────────────────────────────────────────────────┘
 `);
}

const topBarTodos = maxIdLength => {
  let id = 'ID';                                                         // inconstant length item
  let check = 'Check';                                                   // 3 length item
  //let brazilianDateType = false;                                       // day first | true or false
  let todosName = groups[actualName];                                    // inconstant length item
  let date = 'Date';                                                     // 2 to 18 length item
  const maxTodosLength = (function () {                                  // inconstant length
    const texts = actualGroup.map(t => t.text);
    return Math.max(...(texts.map(el => el.length)));
  })();

  const minColumns = 15;                                                 // min column task size

  // make ID have the same size of the largest item
  while (id.length < maxIdLength) id = ` ${id}`;
  // make date have the same size of the items
  while (date.length < 16) date += ' ';

  // part without group's name

  // 0X0001 when adding colors in a string we have to add characters for the terminal
  // read them as colors
  // because of that they are counted when getting they length
  // for fix this we have to call the functions that add colors and remove them the times
  // that wee add to the string
  // in this case it is 3, then we call them 3 and remove them length to not be counted
  // yes
  // its weird
  // but what can i do, right?
  // its javascript afterall
  const lengthColorsRemove = `${colors.inverse('')}`.length +
                             `${colors.inverse('')}`.length +
                             `${colors.inverse('')}`.length + 1;
  
  const startPart = `${colors.inverse(id)} ${colors.inverse(check)} ${colors.inverse(date)}`;


  const startPartLength = startPart.length - lengthColorsRemove;
  // -1 because terminal sometimes read more one line with a custom rezise
  let columnsTerminal = process.stdout.columns - startPartLength;

  // make check have the same size of the largest item
  // minus 2 because this has to count the 2 spaces
  while (todosName.length < columnsTerminal - 2) todosName += ' ';
  // min length for task string...
  if (columnsTerminal < minColumns) columnsTerminal = minColumns;

  // top bar
  console.log(`${startPart} ${colors.inverse(todosName)}\n`);
  return startPartLength; // Return columsTerminal
}

const bottomPartTodos = () => {
  // show groups
  // map array to make the group selected more visible
  const newGroups = groups.map((group) => {
    if (group === groups[actualName]) return colors.underline(group);
    else return group;
  });
  let groupsString = `${newGroups.join(' ')}`;
  while (groupsString.length < process.stdout.columns) groupsString = ` ${groupsString} `;
  return console.log('\n' + groupsString);
};

const showTodos = () => {
  // inconstant length
  let maxIdLength = (actualGroup.length.toString()).length;
  // group information
  const startPartLength = topBarTodos(maxIdLength);
  const columnsTerminal = process.stdout.columns - startPartLength - 2;
  const columnsSeparator = process.stdout.columns - maxIdLength - 2;

  // Todos
  actualGroup.forEach((todo, index) => {
    // prettier the index in the output to be
    // the exactly width of the last todo's index
    index = index.toString();
    while (index.length < maxIdLength || index.length < 2) index = ` ${index}`;

    // if it is a separator
    if (todo.separator) {
      let separator = todo.text;

      if (separator.length === 1)
        while (separator.length <= columnsSeparator - 1) separator += todo.text;
      else
        while (separator.length <= columnsSeparator - 2) separator = ` ${separator} `;

      return console.log(colors.white(`${index} ${separator}`));
    };


    let task = todo.text;
    const activity = todo.lastActivity;
    const status = todo.isChecked ? '(+)' : '( )';
    const color = todo.isChecked ? colors.white : colors.bwhite;
    const actualTime = formatTodoTime(
      todo.lastUpdated,
      todo.repeatTime,
      todo.lastRepeated);


    // for every todo there's a start string 
    const startString = `${index} ${color(status)} ${color(activity)} ${colors.white(actualTime)}`;


    if (task.length > columnsTerminal) {
      let separator = '';
      while (separator.length <= startPartLength + 1) separator += ' ';

      const matchLimit = new RegExp(`.{1,${columnsTerminal}}`, 'g');
      const allStrings = task.match(matchLimit);

      allStrings.forEach((string, si) => {
        // output final for the first line of the task > show data, status
        if (si === 0)
          console.log(`${startString} ${color(string)}`);
        // output final for the rest of the lines > only task
        else {
          string = string.replace(/^\s/, '');
          while (string.length < columnsTerminal) string += ' ';
          console.log(separator + color(string));
        }
      });
    } else console.log(`${startString} ${color(task)}`);
  });


  // groups
  bottomPartTodos();
};

//
// Read Arguments
//

// Ask for a command
const askForATask = (help) => {
  console.clear();
  if (help === true) showHelp();
  else if (help === 2) showProtec();
  else if (help === 3) showLicense();
  else showTodos();
  testTodos();
  rl.question(colors.white('> '), (answer) => {
    [answer, ...args] = answer.split(' ');
    checkTask(answer, args);
  });
}

// Get command and pass to function
const checkTask = async (answer, args) => {
  let help = false;
  answer = answer.toLowerCase();
  switch (answer) {
    case 'a':
    case 'add':
      addTodo(args);
      break;
    case 'x':
    case 'check':
      checkTodos(args);
      break;
    case 's':
    case 'switch':
      switchTodo(args);
      break;
    case 'as':
    case 'addseparator':
      addSeparator(args);
      break;
    case 'r':
    case 'rem':
      removeTodos(args);
      break;
    case 'et':
    case 'edittime':
      editTimed(args);
      break;
    case 'at':
    case 'addtime':
      addTodoTimed(args);
      break;
    case 'checkgroup':
    case 'cg':
      checkGroup(args);
      groups = Object.keys(todos);
      actualGroup = todos[groups[actualName]];
      break;
    case 'addgroup':
    case 'ag':
      addGroup(args);
      groups = Object.keys(todos);
      break;
    case 'remgroup':
    case 'rg':
      removeGroup(args);
      groups = Object.keys(todos);
      actualGroup = todos[groups[actualName]];
      break;
    case 'namegroup':
    case 'ng':
      await nameGroup(args);
      groups = Object.keys(todos);
      // the group is selected in the function
      // since it's referring to a object name
      // and it's easier and faster to use this way.
      break;
    case 'tab':
    case 't':
      tabGroup();
      groups = Object.keys(todos);
      break;
    case 'showgroup':
    case 'sg':
      showGroup(args.join(' '));
      actualGroup = todos[groups[actualName]];
      break;
    case 'c':
    case 'copy':
      copyTodo(args);
      break;
    case 'm':
    case 'move':
      moveTodo(args);
      break;
    case 'g':
    case 'get':
      getCopy(args);
      break;
    case 'h':
    case 'help':
      help = true;
      break;
    case 'rc':
    case 'remcheckeds':
      remCheckedTodos();
      break;
    case 'protec':
      help = 2;
      break;
    case 'l':
    case 'license':
      help = 3;
      break;
    case 'ed':
    case 'edit':
      editTodo(args);
      break;
    case 'rs': 
    case 'restart':
      start();
      break;
    case 'e':
    case 'exit':
      saveData();
      console.clear();
      rl.close();
      process.exit();
      break;
    default:
      help = false;
  }
  saveData();
  askForATask(help);
}

//
// Data Functions
//

// Load all the files or create them
const loadFile = () => {
  try {
    //redos = JSON.parse(fs.readFileSync('redos.json', 'utf8'));
    OTODOS = JSON.parse(fs.readFileSync('todos.json', 'utf8'));
    todos = JSON.parse(fs.readFileSync('todos.json', 'utf8'));
    // load all the groups and return their names
    groups = Object.keys(todos);
    // choose the first group (default)
    actualName = 0;
    actualGroup = todos[groups[actualName]];
    askForATask(false);
  } catch (err) {
    if (err.code === 'ENOENT') {
      //
      // Templates
      //
      // ! Remember that the templates must be STRING to parse through fs.writeFileSync
      const templateTodos = ' ' + {
        "default": [
          {
            "isChecked": false,
            "text": "Check me to test if is working!",
            "lastActivity": ">",
            "lastUpdated": Date.now()
          },
          {
            "isChecked": true,
            "text": "You can remove this template todo!",
            "lastActivity": "»",
            "lastUpdated": Date.now()
          }
        ]
      };
      //const templateRedos = '[]';

      // 
      // Code Run
      //
      // if only is missing redos files
      /*if (!redos && todos) {
        fs.writeFileSync('config.json', templateConfig, 'utf8');
        fs.writeFileSync('redos.json', templateRedos, 'utf8');
        redos = JSON.parse(fs.readFileSync('redos.json', 'utf8'));
        return askForATask(false);
      }*/
      // if is missing both files generate them
      fs.writeFileSync('todos.json', templateTodos, 'utf8');
      //fs.writeFileSync('redos.json', templateRedos, 'utf8');
      //redos = JSON.parse(fs.readFileSync('redos.json', 'utf8'));
      todos = JSON.parse(fs.readFileSync('todos.json', 'utf8'));
      // load all the groups and return their names
      groups = Object.keys(todos);
      // choose the first group (default)
      actualGroup = todos[groups[0]];
      return askForATask(false);
    } else {
      console.log(err);
      process.exit(0);
    }
  }
}

// Save files
const saveData = () => {
  // just save if there's any change (optimization)
  if (todos !== OTODOS) {
    fs.writeFileSync('todos.json', JSON.stringify(todos, null, 2), 'utf8');
    //fs.writeFileSync('redos.json', JSON.stringify(redos, null, 2), 'utf8'); 
    // |, null, 2| for prettier output
  };
}

start();