/*!
 * Gulp automation to preprocess Bootstrap v3.x for Drupal sites
 * Developed by Aalap Shah (http://aalapshah.in)
 * Year 2018
 * Licensed under the MIT license
 */

const version = '1.0.0'                               // script version
const pkgDel = require('del');                        // to delete directories and files
const pkgLog = require('fancy-log');                  // log to terminal
const pkgFs  = require('fs');                         // interact with file system, like check if file exists etc. does not require entry in package.json
const pkgGulp = require('gulp');                      // automation engine
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

welcomeMessage();

const themeRootDirPath = pkgPath.join(process.cwd(), '..');
const themeScssDirPath = pkgPath.join(themeRootDirPath, 'scss');
const themeScssFilePath = pkgPath.join(themeRootDirPath, 'scss', 'style.scss');
const themeCssDirPath = pkgPath.join(themeRootDirPath, 'css');
const themeCssFilePath = pkgPath.join(themeCssDirPath, pkgPath.basename(themeScssFilePath, '.scss') + '.css');

const devBuild = (argv.dev !== undefined && argv.dev);
const sassOutputStyle = ['compact', 'compressed', 'expanded', 'nested'].includes(
    argv.sassoutputstyle === undefined ? '' : argv.sassoutputstyle.toLowerCase())
    ? argv.sassoutputstyle.toLowerCase() : (devBuild ? 'expanded' : 'compressed');

validatePaths([[themeScssDirPath, 'D'], [themeScssFilePath, 'F'], [themeCssDirPath, 'D']]);

pkgGulp.task('default', function() {
  invocationMessage();
  pkgRunSequence('?', 'watch');
});

pkgGulp.task('?', function() {
  pkgLog.info('>= HELP =============================================================>');
  pkgLog.info('gulp');
  pkgLog.info('    [default]|sass');
  pkgLog.info('    --dev');
  pkgLog.info('    [--sassoutputstyle compact|compressed|expanded|nested]');
  pkgLog.info('<= HELP =============================================================<');
});

pkgGulp.task('watch', function() {
  pkgRunSequence(['watch:sass']);
})

pkgGulp.task('watch:sass', ['sass'], function() {
  pkgLog('Watching: ' + themeScssDirPath + '/**/*.scss');
  pkgGulp.watch(themeScssDirPath + '/**/*.scss', ['sass']);
})

pkgGulp.task('watchx', function() {
  pkgLivereload.listen();
  pkgGulp.watch('./wp-content/themes/olympos/lib/*.js', ['uglify']);
  pkgGulp.watch(['./wp-content/themes/olympos/style.css', './wp-content/themes/olympos/*.php', './wp-content/themes/olympos/js/*.js', './wp-content/themes/olympos/parts/**/*.php'], function (files){
    pkgLivereload.changed(files)
  });
});

pkgGulp.task('clean:sass', function() {
  sassMaps = themeCssDirPath + '/*.map';
  pkgLog('Removing maps: ' + sassMaps);
  pkgDel.sync([sassMaps], {force: true});
})

pkgGulp.task('sass', ['clean:sass'], function() {
  invocationMessage();
  pkgLog('Executing Sass preprocessor...');
  pkgLog('Input : ' + themeScssFilePath);
  pkgLog('Output: ' + themeCssFilePath);
  pkgGulp.src(themeScssFilePath)                            // concerned only with one single file - style.scss
      .pipe(pkgIf(devBuild, pkgSourcemaps.init()))          // create sourcemaps only if dev build
      .pipe(pkgSass({outputStyle: sassOutputStyle}).on('error', pkgSass.logError))
      .pipe(pkgAutoprefixer('last 2 version', 'safari 5', 'ie 7', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4'))
      .pipe(pkgIf(devBuild, pkgSourcemaps.write('./')))     // write sourcemap only if dev build
      .pipe(pkgGulp.dest(themeCssDirPath));
});

/* Displays welcome message when script starts
 */
function welcomeMessage() {
  pkgLog.info('Gulp automation to preprocess Bootstrap v3.x for Drupal sites');
  pkgLog.info('Copyright 2018 Aalap Shah (http://aalapshah.in)');
  pkgLog.info('Version ' + version);
  pkgLog.info('Use \'gulp ?\' for help, Ctrl+C to terminate');
}

/* There are command line args that control the way the script behaves. It is
 * nice to show to the developer the main parameters that the script is going to
 * use.
 */
function invocationMessage() {
  if (invocationMessage.done === undefined) {    // js doesn't have static variables, but this behaves like one
    invocationMessage.done = true;               // message once shown won't be shown again
    pkgLog.info('>= INVOCATION PARAMETERS ============================================>');
    pkgLog.info('Build For        : ' + (devBuild ? 'Development' : 'Production'));
    pkgLog.info('Source Maps      : ' + (devBuild ? 'Generated' : 'Not generated'));
    pkgLog.info('Sass Output Style: ' + sassOutputStyle);
    pkgLog.info('<= INVOCATION PARAMETERS ============================================<');
  }
};

/* Checks if a path is a valid directory or file.
 * Type can be of type 'D' or 'F' (case-insensitive).
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

/* Tried to write a common function so as not to write the same code for
 * various file system objects that need to be checked before processing starts.
 */
function validatePaths(pathArray) {
  for (var idx in pathArray) {
    path = pathArray[idx];
    if (!isValidPath(path[0], path[1])) {
      pkgLog(`Error: ${path[0]} is not a valid ${path[1] === 'D' ? 'directory' : 'file'}`);
      process.exit(-1);
    }
  }
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
