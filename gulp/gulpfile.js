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
 *         myFunc.staticVar = true     // no longer undefined
 *         ...                         // do something for the first invocation
 *       }
 *     }
 * -----------------------------------------------------------------------------
 */

const version = '1.0.1'                                 // script version
const pkgColors       = require('colors');              // colors to console, provides additional String.prototype
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
const pkgImagemin     = require('gulp-imagemin');       // to optimize images (png, jpg, jpeg, gif
const pkgUglifyjs     = require('gulp-uglify');         // minify js or css, optional, comment out if not used
const pkgConcat       = require('gulp-concat');         // to concatenate files into one

const argv = new pkgYargs
    .option('B', {alias: 'beep', default: false, type: 'boolean'})
    .option('D', {alias: 'dev', default: false, type: 'boolean'})
    .option('V', {alias: 'verbose', default: false, type: 'boolean'})
    .option('d', {alias: 'drupalroot', default: '', type: 'string'})
    .option('t', {alias: 'theme', default: '', type: 'string'})
    .option('m', {alias: 'sourcemap', default: false, type: 'boolean'})
    .option('y', {alias: 'style', default: '', type: 'string'})
    .option('s', {alias: 'scssdir', default: '', type: 'string'})
    .option('c', {alias: 'cssdir', default:'', type: 'string'})
    .option('F', {alias: 'scssfiles', default:'', type: 'string'})
    .option('l', {alias: 'livereload', default:'', type: 'string'})
    .option('i', {alias: 'imagemin', default:'', type: 'string'})
    .option('u', {alias: 'uglifyjss', default:'', type: 'string'})
    .option('v', {alias: 'uglifyjsd', default:'', type: 'string'})
    .option('w', {alias: 'uglifyjsf', default:'', type: 'string'})
    .argv;

/* -----------------------------------------------------------------------------
 * Writes a log message to console with time or user defined prefix.
 * -----------------------------------------------------------------------------
 */
class Log {
  constructor(prefix='', beep=false, verbose=false) {
    this.prefix = prefix.toString();
    if (this.prefix !== '') {
      this.prefix = fitLength(this.prefix.toUpperCase(), 8, ' ', true);
    }
    this.beep = (beep ? '\x07' : '');
    this.verbose = verbose;
  }
  log(text, color='', type='', indent=0, beep=false, prefix='') {
    if (Array.isArray(text)) {
      for (var idx in text) {
        this.log(text[idx], color, type, indent, beep, prefix);
      }
    } else if (type !== 'd' || this.verbose) {
      switch (type) {
        case 'w':
          type = 'WRN '.yellow;
          break;
        case 'e':
          type = 'ERR '.red;
          break;
        case 'd':
          type = 'DBG '.grey;
          break;
        default:
          type = '';
      }
      console.log('['.white
          + (prefix === ''
              ? (this.prefix === '' ? getTime() : this.prefix)
              : fitLength(prefix.toUpperCase(),8, ' ', true)).stripColors.grey
          + '] '.white
          + type
          + ' '.repeat(indent)
          + (color==='' ? text : text.stripColors[color])
          + (beep ? this.beep : ''));
    }
    return this;
  }
  dbg(text, color='grey', indent=0, beep=false) {
    return this.log(text, (color === '' ? 'grey' : color), 'd', indent, beep);
  }
  inf(text, color='white', indent=0, beep=false) {
    return this.log(text, (color === '' ? 'white' : color), '', indent, beep);
  }
  wrn(text, color='yellow', indent=0, beep=false) {
    return this.log(text, (color === '' ? 'yellow' : color), 'w', indent, beep);
  }
  err(text, color='red', indent=0, beep=false) {
    return this.log(text, (color === '' ? 'red' : color), 'e', indent, beep);
  }
  don(text) {
    return this.log((text.toUpperCase() + ' Done'), 'yellow', '', 0, true);
  }
  sep(text='', char='=', length=69) {
    return this.log(char.repeat(2).white
        + text.toUpperCase().green
        + char.repeat(length - 2 - text.length).white);
  }
  ter(text, indent=0) {
    this.err(text, '', indent, true);
    process.exit(-1);
  }
}

function imagemin() {
  if (imagemin.singleton ===  undefined) {
    imagemin.singleton = new ItemArray(argv.imagemin);

    if (sass.singleton !== undefined) {
      imagemin.singleton.add([
        pkgPath.join(sass.singleton.themeimagedir),
        pkgPath.join(sass.singleton.assetsdir)
      ]);
    }

    imagemin.singleton.filep = [];
    for (var idx in imagemin.singleton.items) {
      imagemin.singleton.filep.push(pkgPath.join(imagemin.singleton.items[idx], '*'));
    }

    if (imagemin.singleton.filep.length === 0) {
      log.wrn('No image directories to process')
          .wrn('Did you miss the parameter to add image directories?');
    } else {
      log.sep(' imagemin-config > ')
          .inf('Image Directories: ')
          .inf(imagemin.singleton.items, '', 2)
          .sep(' < imagemin-config ');
    }
  }
  return imagemin.singleton;
}

function sass() {
  if (sass.singleton === undefined) {
    sass.singleton = new Sass(argv.dev, argv.style, argv.sourcemap
        , argv.scssdir, argv.cssdir, argv.scssfiles
        , argv.drupalroot, argv.theme
        , argv.verbose);
  }
  return sass.singleton;
}

/* -----------------------------------------------------------------------------
 * Sass class that takes care of all sass processing
 * -----------------------------------------------------------------------------
 */
class Sass {
  constructor(dev=false, style='compressed', sourcemap=false
              , scssdir='', cssdir='', scssfiles=''
              , drupalroot='', theme=''
              , verbose=false) {
    this.dev = dev;
    this.verbose = verbose;
    this.scssdir = this.cssdir = '';
    this.scssfiles = [];
    this.scssfilepaths = [];
    this.templatedir = '';
    this.templatefiles = '';
    this.cssfiles = '';
    this.themeimagedir = '';
    this.assetsdir = '';

    var referencedir = '';

    if (scssdir !== '' || cssdir !== '') {
      if (scssdir !== '') {
        if (!isValidPath(scssdir, 'd')) {
          log.ter('SCSS directory \'' + scssdir + '\' is not valid');
        } else {
          referencedir = this.scssdir = scssdir;
        }
        if (cssdir === '') {
          log.inf('CSS directory not known, trying to locate...');
          var cssdir_try = [
              pkgPath.join(this.scssdir, '..', 'css'),
              pkgPath.join(this.scssdir, 'css'),
          ];
          for (var idx in cssdir_try) {
            log.inf('Checking CSS directory ' + cssdir_try[idx]);
            if (isValidPath(cssdir_try[idx], 'd')) {
              this.cssdir = cssdir_try[idx];
              break;
            }
          }
          if (this.cssdir === '') {
            log.ter('Provide valid CSS directory');
          }
        }
      }
      if (cssdir !== '') {
        if (!isValidPath(cssdir, 'd')) {
          log.ter('CSS directory \'' + cssdir + '\' is not valid');
        } else {
          referencedir = this.cssdir = cssdir;
        }
        if (scssdir === '') {
          log.inf('SCSS directory not known, trying to locate...');
          var scssdir_try = [
            pkgPath.join(this.cssdir, '..', 'scss'),
            pkgPath.join(this.cssdir, 'scss'),
          ];
          for (var idx in scssdir_try) {
            log.inf('Checking SCSS directory ' + scssdir_try[idx]);
            if (isValidPath(scssdir_try[idx], 'd')) {
              this.scssdir = scssdir_try[idx];
              break;
            }
          }
          if (this.scssdir === '') {
            log.ter('Provide valid SCSS directory');
          }
        }
      }
    } else if (drupalroot !== '' || theme !== '') {
      if (drupalroot === '') {
        drupalroot = pkgPath.join(process.cwd(), '..');
      } else if (!isValidPath(drupalroot, 'd')) {
        log.ter('Drupal root directory \'' + drupalroot + '\' is not valid');
      }

      if (theme === '') {
        log.ter('Drupal is indicated, but no theme name was supplied');
      }
      var themedir_try = [
          pkgPath.join(drupalroot, 'themes', theme)
        , pkgPath.join(drupalroot, 'themes', 'custom', theme)
        , pkgPath.join(drupalroot, 'web', 'themes', theme)
        , pkgPath.join(drupalroot, 'web', 'themes', 'custom', theme)
      ];
      var themedir = '';
      for (var idx in themedir_try) {
        log.inf('Checking theme directory ' + themedir_try[idx]);
        if (isValidPath(themedir_try[idx], 'd')) {
          themedir = themedir_try[idx];
          break;
        }
      }
      if (themedir === '') {
        log.err('Could not find valid Drupal theme directory', 0, true)
            .ter('Provide a valid theme name');
      }
      referencedir = this.scssdir = pkgPath.join(themedir, 'scss');
      this.cssdir = pkgPath.join(themedir, 'css');
    } else {
      log.err('Insufficient arguments, cannot proceed')
          .ter('Use -d, -t or -s, -c');
    }

    this.cssfiles = pkgPath.join(this.cssdir, '*.css');

    var templatedir = pkgPath.join(referencedir, '..', 'templates');
    if (isValidPath(templatedir, 'd')) {
      this.templatedir = templatedir;
      this.templatefiles = pkgPath.join(this.templatedir, '**', '*.twig');
      log.inf('Template directory detected ' + this.templatedir);
    }

    var themeimagedir = pkgPath.join(referencedir, '..', 'images');
    if (isValidPath(themeimagedir, 'd')) {
      this.themeimagedir = themeimagedir;
      log.inf('Theme images directory detected ' + this.themeimagedir);
    }

    var assetsdir_try = [
          pkgPath.join(referencedir, '..', '..', '..', 'sites', 'default', 'files'),
          pkgPath.join(referencedir, '..', '..', '..', '..', 'sites', 'default', 'files'),
    ];
    for (var idx in assetsdir_try) {
      if (isValidPath(assetsdir_try[idx], 'd')) {
        this.assetsdir = assetsdir_try[idx];
        log.inf('Assets directory detected ' + this.themeimagedir);
        break;
      }
    }

    scssfiles = (scssfiles === '' ? ['style.scss'] : scssfiles.split(','));
    for (var idx in scssfiles) {
      var scssfilepath = pkgPath.join(this.scssdir, scssfiles[idx]);
      if (isValidPath(scssfilepath, 'f')) {
        this.scssfiles.push(scssfiles[idx]);
        this.scssfilepaths.push(scssfilepath);
      } else {
        log.ter('SCSS file \'' + scssfilepath + '\' is invalid', 0, true);
      }
    }

    this.style = (style === '')
        ? (this.dev ? 'expanded' : 'compressed') : style.toLowerCase();
    if (!['compact', 'compressed', 'expanded', 'nested'].includes(this.style)) {
      log.ter('SASS Style ' + style + ' is invalid');
    }
    this.sourcemap = (sourcemap || this.dev);
    log.sep(' sass-config > ')
        .inf('Build For           : ' + (this.dev ? 'Development' : 'Production'))
        .inf('SCSS Dir            : ' + this.scssdir)
        .inf('SCSS Files (Watch)  : ' + pkgPath.join('**', '*.scss'))
        .inf('SCSS Files (Process): ' + this.scssfiles)
        .inf('CSS Dir             : ' + this.cssdir)
        .inf('Source Map          : ' + (this.sourcemap ? 'Generate' : 'Remove'))
        .inf('CSS Style           : ' + this.style)
        .sep(' < sass-config ');
    return this;
  }
  watch() {
    var scssFilePattern = pkgPath.normalize(this.scssdir + '/**/*.scss');
    log.inf('Watching ' + scssFilePattern);
    pkgGulp.watch(scssFilePattern, ['sass']);
    return this;
  }
  /* ---------------------------------------------------------------------------
   * This task creates CSS from one single core SCSS file. It first runs the
   * sass-clean task to remove the Sourcemaps, then based on flags, creates new
   * Sourcemap (or not), then runs the sass preprocessor. This task does not
   * watch any files, that job is done by other task sass-watch.
   * ---------------------------------------------------------------------------
   */
  preprocess() {
    pkgGulp.src(this.scssfilepaths)                               // concerned only with one single file - style.scss
        .pipe(pkgIf(this.sourcemap, pkgSourcemaps.init()))        // create sourcemaps only parameter set
        .pipe(pkgSass({outputStyle: this.style}).on('error', pkgSass.logError))
        .pipe(pkgAutoprefixer('last 2 version', 'safari 5', 'ie 7', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4'))
        .pipe(pkgIf(this.sourcemap, pkgSourcemaps.write('./')))   // write sourcemap only if dev build
        .pipe(pkgGulp.dest(this.cssdir))
        .on('end', function() {log.don('sass-preprocess');});
    return this;
  }
  clean() {
    var sourceMapFilePattern = pkgPath.join(this.cssdir, '*.map');
    log.inf('Removing maps ' + sourceMapFilePattern);
    pkgDel.sync([sourceMapFilePattern], {force: true});
    log.don('sass-clean');
    return this;
  }
}

class ItemArray {
  constructor(items, filedelim=',', verbose=false) {
    this.items = [];
    this.filedelim = filedelim;
    this.add(items);
    return this;
  }
  add(items) {
    if (!Array.isArray(items)
        && items.indexOf(this.filedelim) >= 0) {
      items = items.split(this.filedelim);
    }
    if (Array.isArray(items)) {
      for (var idx in items) {
        this.add(items[idx]);
      }
    } else if ((items = items.trim()) !== '') {
      this.remove(items);
      this.items.push(items);
    }
    return this;
  }
  remove(items) {
    if (!Array.isArray(items)
        && items.indexOf(this.filedelim) >= 0) {
      items = items.split(this.filedelim);
    }
    if (Array.isArray(items)) {
      for (var idx in items) {
        this.remove(items[idx]);
      }
    } else if ((items = items.trim()) !== '') {
      for (var idx in this.items) {
        if (items.trim === this.items[idx]) {
          this.items.splice(idx, 1);
        }
      }
    }
    return this;
  }
}

/* -----------------------------------------------------------------------------
 * Gets current time.
 * -----------------------------------------------------------------------------
 */
function getTime() {
  now = new Date();
  return fitLength(now.getHours(), 2, '0') + ':'
      + fitLength(now.getMinutes(), 2, '0') + ':'
      + fitLength(now.getSeconds(), 2, '0');
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
function fitLength(text, targetLength, padChar=' ', padRight=false) {
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
  log.inf('gulp-drupal-bootstrap, v' + version)
      .inf('Gulp automation for Drupal-Bootstrap development')
      .inf('Developed by Fishfin (https://github.com/fishfin), 2018')
      .inf('Use \'gulp usage\' for help, Ctrl+C to terminate');
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
      log.err(`${path[0]} is not a valid ${path[1] === 'D' ? 'directory' : 'file'}
        `, 0, true);
      process.exit(-1);
    }
  }
}

const log = new Log('', argv.beep, argv.verbose);

showWelcomeMessage();

pkgGulp.task('default', function() {
  pkgRunSequence('watch');
});

pkgGulp.task('watch', function() {
  pkgRunSequence(['sass-watch', 'livereload', 'imagemin']);
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
  var srcfiles = new ItemArray(argv.livereload);
  if (sass.singleton !== undefined) {
    srcfiles.add([sass.singleton.cssfiles,  sass.singleton.templatefiles]);
  }
  if (srcfiles.items.length === 0) {
    log.wrn('Nothing to watch for Livereload')
        .wrn('Did you miss the parameter to add livereload files?');
    return;
  }
  log.sep(' livereload-config > ')
      .inf('Watching for LiveReload:')
      .inf(srcfiles.items, '', 2)
      .sep(' < livereload-config ');
  pkgLivereload.listen();
  //pkgGulp.watch('./wp-content/themes/olympos/lib/*.js', ['uglify']);
  pkgGulp.watch(srcfiles.items
      , function(files) {pkgLivereload.changed(files) });
});

pkgGulp.task('imagemin', function () {
  imagemin();
  for (idx in imagemin.singleton.filep) {
    pkgGulp.src(imagemin.singleton.filep[idx])
        .pipe(pkgImagemin([
          pkgImagemin.gifsicle({interlaced: true}),
          pkgImagemin.jpegtran({progressive: true}),
          pkgImagemin.optipng({optimizationLevel: 5}),
          pkgImagemin.svgo({
            plugins: [{removeViewBox: true}]})]))
        .pipe(pkgGulp.dest(imagemin.singleton.items[idx]))
        .on('end', function() {log.don('imagemin');});
  }
});

pkgGulp.task('uglifyjs', function() {
  var uglifyjss = pkgPath.join((argv.uglifyjss === '' ? process.cwd() : argv.uglifyjss),
      '*.js');
  var uglifyjsd = (argv.uglifyjsd === '' ? process.cwd(): argv.uglifyjsd);
  var uglifyjsf = (argv.uglifyjsf === '' && argv.uglifyjsf.endsWith('.js'))
      ? argv.uglifyjsf : argv.uglifyjsf + '.min.js';
  log.sep(' uglifyjs-config >')
      .inf('Source Dir     : ' + uglifyjss)
      .inf('Destination Dir: ' + uglifyjsd)
      .inf('Ugly File      : ' + (uglifyjsf === '' ? 'Not provided' : uglifyjsf))
      .inf('Source Map     : ' + (argv.sourcemap ? 'Generate' : 'Remove'))
      .sep(' < uglifyjs-config ');

  var sourceMapFilePattern = pkgPath.join(uglifyjsd, '*.map');
  log.inf('Removing maps ' + sourceMapFilePattern);
  pkgDel.sync([sourceMapFilePattern], {force: true});

  if (argv.uglifyjsf === '') {
    pkgGulp.src(uglifyjss)
        .pipe(pkgIf(argv.sourcemap, pkgSourcemaps.init()))        // create sourcemaps only parameter set
        .pipe(pkgUglifyjs())
        .pipe(pkgIf(argv.sourcemap, pkgSourcemaps.write('./')))   // write sourcemap only if dev build
        .pipe(pkgGulp.dest(uglifyjsd));

  } else {
    pkgGulp.src(uglifyjss)
        .pipe(pkgIf(argv.sourcemap, pkgSourcemaps.init()))        // create sourcemaps only parameter set
        .pipe(pkgConcat(uglifyjsf))
        .pipe(pkgGulp.dest(uglifyjsd))
        //      .pipe(pkgIf(arg['uglifyjs-file'] !== '', pkgRename(argv.uglifyjsf)))
        .pipe(pkgUglifyjs())
        .pipe(pkgIf(argv.sourcemap, pkgSourcemaps.write('./')))   // write sourcemap only if dev build
        .pipe(pkgGulp.dest(uglifyjsd));
  }
});

/* -----------------------------------------------------------------------------
 * Displays message on usage of the script, with options that are available on
 * the command prompt.
 * -----------------------------------------------------------------------------
 */
pkgGulp.task('usage', function() {
  log.sep(' usage > ')
      .inf('Usage: gulp [command] [options]', 'cyan')
      .inf('Commands:', 'cyan')
      .inf('  [default]         Execute all features')
      .inf('  imagemin          Minify images')
      .inf('  livereload        Watch CSS, JS and Template directories, and reload browser,')
      .inf('                    requires browser add-ons:')
      .inf('                    Chrome: https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei')
      .inf('                    Firefox: https://addons.mozilla.org/en-US/firefox/addon/livereload-web-extension/')
      .inf('                    More info on extensions at http://livereload.com/extensions/')
      .inf('  sass-watch        Watch Sass directory and execute preprocessor')
      .inf('  sass              Execute only Sass preprocessor')
      .inf('  sass-clean        Remove *.map files')
      .inf('  uglifyjs          Minimfies JavaScript files')
      .inf('  usage             Display usage information')
      .inf('Options:', 'cyan')
      .inf('  -B, --beep        Beep on completion of important task          [boolean]')
      .inf('  -D, --dev         Use Development options for building          [boolean]')
      .inf('  -V, --verbose     Log detailed messges                          [boolean]')
      .inf('  -d, --drupalroot  Specify Drupal root directory, use with -t    [optional]')
      .inf('  -t, --theme       Drupal theme directory name, use with -d')
      .inf('  -s, --scssdir     SCSS directory to watch and process, use with -c')
      .inf('  -c, --cssdir      CSS directory for SASS output, use with -s')
      .inf('  -e, --scssfiles   SCSS files to preprocess, comma-delimited')
      .inf('  -y, --style       Sass output style, compact|compressed|expanded|nested')
      .inf('  -m, --source-map  Creates sourcemap (*.map) files               [boolean]')
      .inf('  -l, --livereload  Watch files for livereload')
      .inf('  -i, --imagemin    Image directories to minify')
      .inf('  -u, --uglifyjss   Uglify JS source directory')
      .inf('  -v  --uglifyjsd   Uglify JS destination directory')
      .inf('  -w  --uglifyjsf   Uglify JS destination file if to be merged')
      .inf('Examples:', 'cyan')
      .inf('  gulp')
      .inf('  gulp sass')
      .inf('  gulp -BDdm -r d:\\htdocs\\d8 -t=mytheme')
      .inf('  gulp --beep --drupalroot d:\\htdocs\\d8')
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
