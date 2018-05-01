/*!
 * Gulp automation for Drupal-Bootstrap development
 * Developed by Fishfin (https://github.com/fishfin)
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

const version = '1.0.0'                                 // script version
const pkgColors       = require('colors');              // colors to console
const pkgDel          = require('del');                 // to delete directories and files
const pkgFs           = require('fs');                  // interact with file system, like check if file exists etc. does not require entry in package.json
const pkgGulp         = require('gulp');                // automation engine
const pkgAutoprefixer = require('gulp-autoprefixer');   // auto vendor prefixes i.e. transform to -webkit-transform, -ms-transform, etc.
const pkgIf           = require('gulp-if');             // useful condition checking in gulp
const pkgLivereload   = require('gulp-livereload');     // aumatically reloads browser when any of source files changes
const pkgSass         = require('gulp-sass');           // sass-preprocessor
const pkgSourcemaps   = require('gulp-sourcemaps');     // inline source map in source files, helpful in debugging
const pkgPath         = require('path');                // utilities to work with files and directories
const pkgRunSequence  = require('run-sequence');        // run tasks in sequence instead of parallel
const pkgYargs        = require('yargs');               // parse command line arguments

const argv = new pkgYargs
    .option('b', {alias: 'beep', default: false, type: 'boolean'})
    .option('d', {alias: 'dev', default: false, type: 'boolean'})
    .option('D', {alias: 'debug', default: false, type: 'boolean'})
    .option('m', {alias: 'sourcemap', default: false, type: 'boolean'})
    .option('r', {alias: 'drupalroot', default: '', type: 'string', demand: true, demand: 'specify drupal root directory'})
    .option('s', {alias: 'style', default: '', type: 'string'})
    .option('t', {alias: 'theme', default: 'mytheme', type: 'string'})
    .argv;
//const pkgConcat = require('gulp-concat');           // to concatenate files into one
//const pkgUglify = require('gulp-uglify');           // minify js, optional, comment out if not used
//const imagemin = require('gulp-imagemin');
//const pngquant = require('imagemin-pngquant');


/* -----------------------------------------------------------------------------
 * Writes a log message to console with time or user defined prefix.
 * -----------------------------------------------------------------------------
 */
class Log {
  constructor(prefix='', beep=false, debug=false, showMessageLabel=true) {
    this.prefix = prefix.toString();
    if (this.prefix !== '') {
      this.prefix = fixLength(this.prefix.toUpperCase(), 8, ' ', true);
    }
    this.beep = (beep ? '\x07' : '');
    this.debug = debug;
    this.showMessageLabel = showMessageLabel;
  }
  raw(text) {
      console.log('['.white
          + (this.prefix === '' ? getTime() : this.prefix).grey
          + '] '.white
          + text);
      return this;
  }
  dbg(text) {
    if (this.debug) {
      this.raw(('DBG: ' + text).stripColors.grey);
    }
    return this;
  }
  inf(text) {
    this.raw((((this.showMessageLabel || this.debug) ? 'INF: ' : '')
        + text).stripColors.cyan);
    return this;
  }
  wrn(text) {
    this.raw((((this.showMessageLabel || this.debug) ? 'WRN: ' : '')
        + text).stripColors.yellow
        + this.beep);
    return this;
  }
  err(text) {
    this.raw((((this.showMessageLabel || this.debug) ? 'ERR: ' : '')
        + text).stripColors.red)
    return this;
  }
  wrb(text) {
    this.wrn(text + this.beep);
    return this;
  }
  erb(text) {
    this.err(text + this.beep);
    return this;
  }
  log(text) {
    this.raw(text.stripColors);
    return this;
  }
  don(text) {
    this.raw((text.toUpperCase() + ' Done').yellow + this.beep);
    return this;
  }
  sep(text='', char='=', length=69) {
    this.raw(char.repeat(2).white
        + text.toUpperCase().green
        + char.repeat(length - 2 - text.length).white);
    return this;
  }
  ter(text) {
    this.err(text);
    process.exit(-1);
  }
}

/* -----------------------------------------------------------------------------
 * Sass class that takes care of all sass processing
 * -----------------------------------------------------------------------------
 */
class Sass {
  constructor(dev=false, drupalroot='', theme='mytheme', style='compressed'
      , sourcemap=false, debug=false) {
    this.drupalroot = drupalroot.trim();
    if (this.drupalroot === '') {
      this.drupalroot = pkgPath.join(process.cwd(), '..');
    } else if (!isValidPath(drupalroot, 'd')) {
      log.ter('Drupal root directory ' + drupalroot + ' is not valid');
    }

    var themedir_try1 = pkgPath.join(this.drupalroot, 'themes', theme);
    var themedir_try2 = pkgPath.join(this.drupalroot, 'themes', 'custom', theme);
    this.themedir = ''
    if (isValidPath(themedir_try1, 'd')) {
      this.themedir = themedir_try1;
    } else if (isValidPath((themedir_try2), 'd')) {
      this.themedir = themedir_try2;
    }
    if (this.themedir === '') {
      log.erb('Could not find valid Drupal theme directory at any of the following locations:')
          .err('  - ' + themedir_try1)
          .err('  - ' + themedir_try2)
          .ter('Provide a valid theme name.');
    }

    this.themedir_scss = pkgPath.join(this.themedir, 'scss');
    if (!isValidPath(this.themedir_scss, 'd')) {
      log.erb('Could not find SCSS directory at ')
          .err(this.themedir_scss)
          .ter('Make sure structure of Bootstrap subtheme is correct.');
    }

    this.themedir_css = pkgPath.join(this.themedir, 'css');
    if (!isValidPath(this.themedir_css, 'd')) {
      log.erb('Could not find CSS directory at ')
          .err(this.themedir_css)
          .ter('Make sure structure of Bootstrap subtheme is correct.');
    }

    this.themefile_scss = pkgPath.join(this.themedir_scss, 'style.scss');
    if (!isValidPath(this.themefile_scss, 'f')) {
      log.erb('Could not find SCSS file at ')
          .err(this.themefile_scss)
          .ter('Make sure structure of Bootstrap subtheme is correct.');
    }

    this.style = (style === '')
        ? (dev ? 'expanded' : 'compressed') : style.toLowerCase();
    if (!['compact', 'compressed', 'expanded', 'nested'].includes(this.style)) {
      log.ter('SASS Style ' + style + ' is invalid');
    }
    this.sourcemap = (sourcemap || dev);
    this.debug = debug;
    log.sep(' sass-config > ')
        .log('Build For        : ' + (this.dev ? 'Development' : 'Production'))
        .log('Drupal Root Dir  : ' + this.drupalroot)
        .log('Theme Dir        : ' + this.themedir)
        .log('Theme SCSS Dir   : ' + this.themedir_scss)
        .log('Theme CSS Dir    : ' + this.themedir_css)
        .log('Source Maps      : ' + (this.sourcemap ? 'Generate' : 'Remove'))
        .log('CSS Output Style : ' + this.style)
        .sep(' < sass-config ');
  }
  watch() {
    var scssFilePattern = pkgPath.normalize(this.themedir_scss + '/**/*.scss')
    log.sep(' sass-watch > ')
        .log('Watching ' + scssFilePattern);
    pkgGulp.watch(scssFilePattern, ['sass']);
    log.sep(' < sass-watch ');
  }
  /* ---------------------------------------------------------------------------
   * This task creates CSS from one single core SCSS file. It first runs the
   * sass-clean task to remove the Sourcemaps, then based on flags, creates new
   * Sourcemap (or not), then runs the sass preprocessor. This task does not
   * watch any files, that job is done by other task sass-watch.
   * ---------------------------------------------------------------------------
   */
  preprocess() {
    log.sep(' sass-preprocess > ')
        .log('Input : ' + this.themefile_scss)
        .log('Output: ' + pkgPath.join(this.themedir_css
            , pkgPath.basename(this.themefile_scss, pkgPath.extname(this.themefile_scss)) + '.css'))
        .sep(' < sass-preprocess ');
    pkgGulp.src(this.themefile_scss)                              // concerned only with one single file - style.scss
        .pipe(pkgIf(this.sourcemap, pkgSourcemaps.init()))        // create sourcemaps only parameter set
        .pipe(pkgSass({outputStyle: this.style}).on('error', pkgSass.logError))
        .pipe(pkgAutoprefixer('last 2 version', 'safari 5', 'ie 7', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4'))
        .pipe(pkgIf(this.sourcemap, pkgSourcemaps.write('./')))   // write sourcemap only if dev build
        .pipe(pkgGulp.dest(this.themedir_css))
        .on('end', function() {log.don('sass-preprocess');});
  }
  clean() {
    var sourceMapFilePattern = pkgPath.normalize(this.themedir_css + '/*.map');
    log.log('Removing maps ' + sourceMapFilePattern);
    pkgDel.sync([sourceMapFilePattern], {force: true});
    log.don('sass-clean');
  }
}

/* -----------------------------------------------------------------------------
 * Gets current time.
 * -----------------------------------------------------------------------------
 */
function getTime() {
  now = new Date();
  return fixLength(now.getHours(), 2, '0') + ':'
      + fixLength(now.getMinutes(), 2, '0') + ':'
      + fixLength(now.getSeconds(), 2, '0');
};

/* -----------------------------------------------------------------------------
 * Checks if a path is a valid directory or file, type can be 'd'|'f'
 * (case-insensitive).
 * -----------------------------------------------------------------------------
 */
function isValidPath(path, type='d') {
  var isValidPath = false;
  type = type.toLowerCase();
  //if (pkgFs.existsSync(path)) {
  try {                   // if the path doesn't exist, statSync throws an error
    var stats = pkgFs.statSync(path);
    if ((type == 'd' && stats.isDirectory()) || (type == 'f' && stats.isFile())) {
      isValidPath = true;
    }
  } catch(err) {}
  //}
  return isValidPath;
}

/* -----------------------------------------------------------------------------
 * Fixes length of input text string to specific value. If input text is
 * smaller, adds directional padding, else substrings
 * -----------------------------------------------------------------------------
 */
function fixLength(text, targetLength, padChar=' ', padRight=false) {
  text = text.toString();
  padChar = padChar.toString();
  padLength = targetLength - text.length;
  if (padLength > 0) {
    padChars = padChar.repeat(Math.ceil(padLength/padChar.length));
    padChars = padChars.substr(padRight ? 0 : (padChars.length - padLength), padLength);
    text = (padRight ? '' : padChars) + text + (padRight ? padChars : '');
  } else if (padLength < 0) {
    text = text.substr(0, targetLength);
  }
  return text;
}

/* -----------------------------------------------------------------------------
 * Displays welcome message, called on start of script.
 * -----------------------------------------------------------------------------
 */
function showWelcomeMessage() {
  log.log('gulp-drupal-bootstrap, v' + version)
      .log('Gulp automation for Drupal-Bootstrap development')
      .log('Developed by Fishfin (https://github.com/fishfin), 2018')
      .log('Use \'gulp usage\' for help, Ctrl+C to terminate');
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
      log.erb(`${path[0]} is not a valid ${path[1] === 'D' ? 'directory' : 'file'}`);
      process.exit(-1);
    }
  }
}

const log = new Log('', argv.beep, argv.debug);

function sass() {
  if (sass.singleton === undefined) {
    sass.singleton = new Sass(argv.dev, argv.drupalroot, argv.theme, argv.style
        , argv.sourcemap, argv.debug);
  }
  return sass.singleton;
}

showWelcomeMessage();

pkgGulp.task('default', function() {
  pkgRunSequence('watch');
});

pkgGulp.task('watch', function() {
  pkgRunSequence(['sass-watch', 'livereload']);
});

pkgGulp.task('sass-clean', function() {
  sass().clean();
});

pkgGulp.task('sass', ['sass-clean'], function() {
  sass().preprocess();
});

pkgGulp.task('sass-watch', ['sass'], function() {
  sass().watch();
});

pkgGulp.task('livereload', function() {
  sass();
  pkgLivereload.listen();
  //pkgGulp.watch('./wp-content/themes/olympos/lib/*.js', ['uglify']);
  pkgGulp.watch([pkgPath.normalize(sass.singleton.themedir_css + '/*.css')
      , pkgPath.normalize(sass.singleton.themedir + '/templates/**/*.twig')]
      , function(files) {pkgLivereload.changed(files) });
});

/* -----------------------------------------------------------------------------
 * Displays message on usage of the script, with options that are available on
 * the command prompt.
 * -----------------------------------------------------------------------------
 */
pkgGulp.task('usage', function() {
  log.sep(' usage > ')
      .log('Usage: gulp [command] [options]')
      .log('')
      .log('Commands:')
      .log('  [default]         Execute all features')
      .log('  livereload        Watch CSS, JS and Template directories, and reload browser,')
      .log('                    requires browser add-ons:')
      .log('                    Chrome: https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei')
      .log('                    Firefox: https://addons.mozilla.org/en-US/firefox/addon/livereload-web-extension/')
      .log('                    More info on extensions at http://livereload.com/extensions/')
      .log('  sass-watch        Watch Sass directory and execute preprocessor')
      .log('  sass              Execute only Sass preprocessor')
      .log('  sass-clean        Remove *.map files')
      .log('  usage             Display usage information')
      .log('')
      .log('Options:')
      .log('  -b, --beep        Beep on completion of important task          [boolean]')
      .log('  -d, --dev         Use Development options for building          [boolean]')
      .log('  -D, --debug       Log debug messages                            [boolean]')
      .log('  -r, --drupalroot  Specify Drupal root directory                [optional]')
      .log('  -s, --style       Sass output style, compact|compressed|expanded|nested')
      .log('  -t, --theme       Drupal theme directory name')
      .log('  -m, --source-map  Creates sourcemap (*.map) files               [boolean]')
      .log('')
      .log('Examples:')
      .log('  gulp')
      .log('  gulp sass')
      .log('  gulp -bdDm -r d:\\htdocs\\d8')
      .log('  gulp --beep --drupalroot d:\\htdocs\\d8_new')
      .sep(' < usage ');
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
