/*!
 * Gulp automation for Drupal-Bootstrap development
 * Developed by Aalap Shah (http://aalapshah.in)
 * Year 2018
 * Licensed under the MIT license
 */

/* -----------------------------------------------------------------------------
 * General Developer Notes:
 *  1) JS doesn't have static variables. Instead of defining global variables,
 *     you could do the following:
 *     function myFunc() {
 *       if (myFunc.staticVar === undefined) {
 *         myFunc.staticVar = true     // now no longer undefined
 *         ...                         // do something for the first invocation
 *       }
 *     }
 * -----------------------------------------------------------------------------
 */
/* Variable name legend:
 *   pkg: Package                       thm: Theme
 */
const version = '1.0.0'                               // script version
const pkgColors = require('colors');                  // colors to console
const pkgDel = require('del');                        // to delete directories and files
//const pkgUtil = require('fancy-log');               // log to terminal
const pkgFs  = require('fs');                         // interact with file system, like check if file exists etc. does not require entry in package.json
const pkgGulp = require('gulp');                      // automation engine
const pkgUtil = require('gulp-util');                 // deprecated but still used by gulp, so reusing, otherwise try fancy-log (but no colors)
const pkgAutoprefixer = require('gulp-autoprefixer'); // auto vendor prefixes i.e. transform to -webkit-transform, -ms-transform, etc.
const pkgIf = require('gulp-if');
const pkgLivereload = require('gulp-livereload');     // aumatically reloads browser when any of source files changes
const pkgPath = require('path');                      // utilities to work with files and directories
const pkgRunSequence = require('run-sequence');
const pkgSass = require('gulp-sass');                 // sass-preprocessor
const pkgSourcemaps = require('gulp-sourcemaps');     // inline source map in source files, helpful in debugging
const argv = require('yargs').argv;                   // parse command line arguments
//const pkgConcat = require('gulp-concat');           // to concatenate files into one
//const pkgUglify = require('gulp-uglify');           // minify js, optional, comment out if not used
//const imagemin = require('gulp-imagemin');
//const pngquant = require('imagemin-pngquant');

/* -----------------------------------------------------------------------------
 * Writes a log message to console with time prefix.
 * -----------------------------------------------------------------------------
 */
function Log() {}
Log.prototype.raw = function(text) {
  console.log('['.white + getTime().grey + '] '.white + text);
};
Log.prototype.dbg = function(text) {
  this.raw(text.stripColors.grey);
};
Log.prototype.inf = function(text) {
  this.raw(text.stripColors.white);
};
Log.prototype.wrn = function(text) {
  this.raw(text.stripColors.yellow);
};
Log.prototype.err = function(text) {
  this.raw(text.stripColors.red);
};
Log.prototype.don = function(text) {
  this.raw((text.toUpperCase() + ' Done').yellow + beep);
};
Log.prototype.sep = function(text='', char='=', length=69) {
  this.raw(char.repeat(2).white
      + text.toUpperCase().red
      + char.repeat(length - 2 - text.length).white);
};

/* -----------------------------------------------------------------------------
 * Gets current time.
 * -----------------------------------------------------------------------------
 */
function getTime() {
  now = new Date();
  return pad(now.getHours(), 2, '0') + ':'
      + pad(now.getMinutes(), 2, '0') + ':'
      + pad(now.getSeconds(), 2, '0');
};

/* -----------------------------------------------------------------------------
 * Checks if a path is a valid directory or file.
 * Type can be of type 'D' or 'F' (case-insensitive).
 * -----------------------------------------------------------------------------
 */
function isValidPath(path, type) {
  var isValidPath = false;
  type = type.toUpperCase();
  //if (pkgFs.existsSync(path)) {
  try {                   // if the path doesn't exist, statSync throws an error
    var stats = pkgFs.statSync(path);
    if ((type == 'D' && stats.isDirectory()) || (type == 'F' && stats.isFile())) {
      isValidPath = true;
    }
  } catch(err) {}
  //}
  return isValidPath;
}

/* -----------------------------------------------------------------------------
 * Pads character to left or right to make string of specified length.
 * -----------------------------------------------------------------------------
 */
function pad(text, targetLength, padChar=' ', padRight=false) {
  text = text.toString();
  padChar = padChar.toString();
  padLength = targetLength - text.length;
  if (padLength > 0) {
    padChars = padChar.repeat(Math.ceil(padLength/padChar.length));
    padChars = padChars.substr(padRight ? 0 : (padChars.length - padLength), padLength);
    text = (padRight ? '' : padChars) + text + (padRight ? padChars : '');
  }
  return text;
}

/* -----------------------------------------------------------------------------
 * There are command line args that control the way the script behaves. It is
 * nice to show to the developer the main parameters that the script is going to
 * use.
 * -----------------------------------------------------------------------------
 */
function showInvocationArgs() {
  if (showInvocationArgs.done === undefined) {    // message displayed only the
    showInvocationArgs.done = true;               // first time it is called
    log.sep(' invocation > ');
    log.inf('Build For        : ' + (devBuild ? 'Development' : 'Production'));
    log.inf('Theme Root Dir   : ' + thmRootDir);
    log.inf('Theme SCSS Dir   : ' + thmScssDir);
    log.inf('Theme CSS Dir    : ' + thmCssDir);
    log.inf('Source Maps      : ' + (genCssSourcemap ? 'Generate' : 'Remove'));
    log.inf('CSS Output Style : ' + cssOutputStyle);
    log.sep(' < invocation ');
  }
}

/* -----------------------------------------------------------------------------
 * Displays welcome message, called on start of script.
 * -----------------------------------------------------------------------------
 */
function showWelcomeMessage() {
  log.inf('gulp-drupal-bootstrap, v' + version);
  log.inf('Gulp automation for Drupal-Bootstrap development');
  log.inf('Developed by Fishfin (https://github.com/fishfin), 2018');
  log.inf('Use \'gulp usage\' for help, Ctrl+C to terminate');
}

/* -----------------------------------------------------------------------------
 * Tried to write a common function so as not to write the same code for
 * various file system objects that need to be checked before processing starts.
 * -----------------------------------------------------------------------------
 */
function validatePaths(pathArray) {
  for (var idx in pathArray) {
    path = pathArray[idx];
    if (!isValidPath(path[0], path[1])) {
      log.inf(`Error: ${path[0]} is not a valid ${path[1] === 'D' ? 'directory' : 'file'}`);
      process.exit(-1);
    }
  }
}

const log = new Log();

showWelcomeMessage();

const beep = (argv.beep === undefined) ? '' : '\x07';
const devBuild = (argv.dev !== undefined);
const cssOutputStyle = ['compact', 'compressed', 'expanded', 'nested'].includes(
    argv.cos === undefined ? '' : argv.cos.toLowerCase())
    ? argv.cos.toLowerCase() : (devBuild ? 'expanded' : 'compressed');
const genCssSourcemap = (argv.smap !== undefined || argv.dev);
const thmRootDir = (argv.btr === undefined)
    ? pkgPath.join(process.cwd(), '..') : argv.btr;
const thmScssDir = (argv.thmscss === undefined)
    ? pkgPath.join(thmRootDir, 'scss') : argv.thmscss;
const thmScssFile = pkgPath.join(thmRootDir, 'scss', 'style.scss');
const thmCssDir = (argv.thmcss === undefined)
    ? pkgPath.join(thmRootDir, 'css') : argv.thmcss;
const thmCssFile = pkgPath.join(thmCssDir, pkgPath.basename(thmScssFile, pkgPath.extname(thmScssFile)) + '.css');

validatePaths([[thmScssDir, 'D'], [thmScssFile, 'F'], [thmCssDir, 'D']]);

pkgGulp.task('default', function() {
  pkgRunSequence('watch');
});

pkgGulp.task('watch', function() {
  showInvocationArgs();
  pkgRunSequence(['watch:sass']);
})

pkgGulp.task('watch:sass', ['sass'], function() {
  showInvocationArgs();
  scssFilePattern = pkgPath.normalize(thmScssDir + '/**/*.scss')
  log.sep(' watch:sass > ');
  log.inf('Watching ' + scssFilePattern);
  pkgGulp.watch(scssFilePattern, ['sass']);
  log.sep(' < watch:sass ');
})

pkgGulp.task('watchx', function() {
  showInvocationArgs();
  pkgLivereload.listen();
  pkgGulp.watch('./wp-content/themes/olympos/lib/*.js', ['uglify']);
  pkgGulp.watch(['./wp-content/themes/olympos/style.css'
    , './wp-content/themes/olympos/*.php'
    , './wp-content/themes/olympos/js/*.js'
    , './wp-content/themes/olympos/parts/**/*.php'], function (files){
    pkgLivereload.changed(files)
  });
});

pkgGulp.task('clean:sass', function() {
  sourceMapFilePattern = pkgPath.normalize(thmCssDir + '/*.map');
  log.inf('Removing maps ' + sourceMapFilePattern);
  pkgDel.sync([sourceMapFilePattern], {force: true});
  log.don('clean:sass');
})

/* -----------------------------------------------------------------------------
 * This task creates CSS from one single core SCSS file. It first runs the
 * clean:sass task to remove the Sourcemaps, then based on flags, creates new
 * Sourcemap (or not), then runs the sass preprocessor. This task does not watch
 * any files, that job is done by other task watch:sass.
 * -----------------------------------------------------------------------------
 */
pkgGulp.task('sass', ['clean:sass'], function() {
  showInvocationArgs();
  log.sep(' sass > ');
  log.inf('Input : ' + thmScssFile);
  log.inf('Output: ' + thmCssFile);
  pkgGulp.src(thmScssFile)                            // concerned only with one single file - style.scss
      .pipe(pkgIf(genCssSourcemap, pkgSourcemaps.init()))        // create sourcemaps only parameter set
      .pipe(pkgSass({outputStyle: cssOutputStyle}).on('error', pkgSass.logError))
      .pipe(pkgAutoprefixer('last 2 version', 'safari 5', 'ie 7', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4'))
      .pipe(pkgIf(genCssSourcemap, pkgSourcemaps.write('./')))   // write sourcemap only if dev build
      .pipe(pkgGulp.dest(thmCssDir))
      .on('end', function() {log.don('sass');});
  log.sep(' < sass ');
});

/* -----------------------------------------------------------------------------
 * Displays message on usage of the script, with options that are available on
 * the command prompt.
 * -----------------------------------------------------------------------------
 */
pkgGulp.task('usage', function() {
  log.sep(' usage > ');
  log.inf('gulp [task-name] [--opt1 [opt1val]] [--opt2 [opt2val]] ...');
  log.sep('', '-');
  log.inf('task-name: [default]|clean:sass|sass|watch:sass');
  log.inf('--beep   : (no value to be provided with this option)');
  log.inf('           when set, beeps once on completion of an important task');
  log.inf('           on completion');
  log.inf('--dev    : (no value to be provided with this option)');
  log.inf('           when set, uses dev defaults for other options,else prod');
  log.inf('           defaults unless overridden');
  log.inf('--cos    : compact|compressed|expanded|nested');
  log.inf('           CSS Output Style (cos) of CSS, if not provided, defaults');
  log.inf('           to \'expanded\' for --dev and \'compressed\' otherwise');
  log.inf('--smap   : (no value to be provided with this option)');
  log.inf('           when set, uses generates CSS Source Maps, otherwise');
  log.inf('           generates by default for --dev otherwise removes');
  log.sep(' < usage ');
});

/* -----------------------------------------------------------------------------
 * Beautifies text with foreground and background color, and other options
 * Usage: console.log(beautifyText(text, ['fggrey', 'bgred', 'inverse']));
 * -----------------------------------------------------------------------------
 */
function beautifyText(text, options) {
  if (beautifyText.textAttributes === undefined) {
    beautifyText.textAttributes = {
      'reset'        : '\x1b[0m' ,
      'bold'         : '\x1b[1m' ,    'end_bold'         : '\x1b[21m',
      'dim'          : '\x1b[2m' ,    'end_dim'          : '\x1b[22m',
      'italic'       : '\x1b[3m' ,    'end_italic'       : '\x1b[23m',
      'underline'    : '\x1b[4m' ,    'end_underline'    : '\x1b[24m',
      'blink'        : '\x1b[5m' ,    'end_blink'        : '\x1b[25m',
      'unknown'      : '\x1b[6m' ,    'end_unknown'      : '\x1b[26m',
      'inverse'      : '\x1b[7m' ,    'end_inverse'      : '\x1b[27m',
      'hidden'       : '\x1b[8m' ,    'end_hidden'       : '\x1b[28m',
      'strikethrough': '\x1b[9m' ,    'end_strikethrough': '\x1b[29m',
      'fgblack'      : '\x1b[30m',    'end_fgblack'      : '\x1b[39m',
      'fgred'        : '\x1b[31m',    'end_fgred'        : '\x1b[39m',
      'fggreen'      : '\x1b[32m',    'end_fggreen'      : '\x1b[39m',
      'fgyellow'     : '\x1b[33m',    'end_fgyellow'     : '\x1b[39m',
      'fgblue'       : '\x1b[34m',    'end_fgblue'       : '\x1b[39m',
      'fgmagenta'    : '\x1b[35m',    'end_fgmagenta'    : '\x1b[39m',
      'fgcyan'       : '\x1b[36m',    'end_fgcyan'       : '\x1b[39m',
      'fgwhite'      : '\x1b[37m',    'end_fgwhite'      : '\x1b[39m',
      'fggrey'       : '\x1b[90m',    'end_fggrey'       : '\x1b[39m',
      'bgblack'      : '\x1b[40m',    'end_bgblack'      : '\x1b[49m',
      'bgred'        : '\x1b[41m',    'end_bgred'        : '\x1b[49m',
      'bggreen'      : '\x1b[42m',    'end_bggreen'      : '\x1b[49m',
      'bgyellow'     : '\x1b[43m',    'end_bgyellow'     : '\x1b[49m',
      'bgblue'       : '\x1b[44m',    'end_bgblue'       : '\x1b[49m',
      'bgmagenta'    : '\x1b[45m',    'end_bgmagenta'    : '\x1b[49m',
      'bgcyan'       : '\x1b[46m',    'end_bgcyan'       : '\x1b[49m',
      'bgwhite'      : '\x1b[47m',    'end_bgwhite'      : '\x1b[49m',
    }
  }
  if (!Array.isArray(options)) {
    options = [options];
  }
  attributes = endAttributes = '';
  for (idx in options) {
    option = options[idx].toLowerCase();
    if (beautifyText.textAttributes[option] !== undefined) {
      attributes = attributes + beautifyText.textAttributes[option];
      endAttributes = beautifyText.textAttributes['end_' + option] + endAttributes;
    }
  }
  return attributes + text + endAttributes; //beautifyText.textAttributes['reset'];
}

/*gulp.task('imagemin', function () {
    return gulp.src('./wp-content/themes/olympos/images/*')
        .pipe(imagemin({
            progressive: true,
            svgoPlugins: [{removeViewBox: false}],
            use: [pngquant()]
        }))
        .pipe(gulp.dest('./wp-content/themes/olympos/images'));
});

pkgGulp.task('uglify', function() {
  gulp.src('./wp-content/themes/olympos/lib/*.js')
    .pipe(pkgUglify('olympos.min.js'))
    .pipe(gulp.dest('./wp-content/themes/olympos/js'))
});
*/
