const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const cheerio = require('cheerio');
const slugify = require('slugify');

const PLUGINS_DIR = './plugins';
const BUCKET = 'https://app.imversed.com/flow-plugins';
const GITHUB_PAGE = 'https://imversed.github.io/flow-plugins/plugins';
const SHOULD_DEPLOY = process.argv.slice(-1)[0] === "deploy";
const HOST_URL = SHOULD_DEPLOY ? BUCKET : GITHUB_PAGE;

console.log('>>> Start building plugins db with host url: ', HOST_URL);

fs.readdir(PLUGINS_DIR, (err, files) => {
    if (err) {
        console.error(`Error reading directory: ${err}`);
        return;
    }

    const fileList = files.filter(file => {
        const filePath = path.join(PLUGINS_DIR, file);
        return fs.statSync(filePath).isFile() && path.extname(file) === '.html';
    });

    const promises = fileList.map(f => {
        return new Promise((resolve, reject) => {
            fs.readFile(path.join(PLUGINS_DIR, f), 'utf8', (err, data) => {
                if (err) {
                    console.error(`Error reading file: ${err}`);
                    reject(err);
                } else {
                    const parser = cheerio.load(data);
                    try {
                        const jsCode = parser('script[total]').first().html().trim();
                        const scriptContext = {
                            exports: {}
                        };
                        eval(`(function(module, exports) { ${jsCode} })(undefined, scriptContext.exports)`);
                        
                        if (Object.keys(scriptContext.exports).length > 0) {
                            const { 
                                inputs, 
                                config, 
                                ...plugin_meta 
                            } = scriptContext.exports;

                            if (!plugin_meta.id) {
                                plugin_meta.id = (() => {
                                    const plugin_name = plugin_meta.name;
                                    const id = slugify(plugin_name, {
                                        lower: true,
                                        remove: /[*+~.()'"!:@]/g,
                                    });
    
                                    return `${id}-imversed`;
                                })();
                            }

                            plugin_meta.readme = (() => {
                                try {
                                    const readme = parser('readme').first().html().trim();
                                    return readme;
                                } catch {
                                    return "";
                                }
                            })();

                            plugin_meta.color = "";
                            plugin_meta.url = `${HOST_URL}/${f}`;

                            resolve(plugin_meta);
                        } else {
                            reject(`Found file with no exports: ${f}`)
                        }

                    } catch (error) {
                        reject(`Unable to find 'total' attribute in file: ${f}`)
                    }
                }
            });
        });
    });

    Promise.all(promises)
        .then(db_file => {
            const json = JSON.stringify(db_file, null, 2);
            fs.writeFile(`${PLUGINS_DIR}/db.json`, json, 'utf8', err => {
                if (err) {
                    console.log("Error occurred while saving db.json");
                } else {
                    console.log(">>> db.json file ready");
                    if (SHOULD_DEPLOY) {
                        upload_to_bucket();
                    }
                }
            });
        })
        .catch(err => {
            console.log("Error occurred while processing files:", err);
        });
});

function upload_to_bucket() {
    console.log(">>> Running upload.sh script...");
    
    exec(`./upload.sh`, (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          return;
        }
        console.log(stdout);

        if (stderr) {
            console.error(stderr);
        }
    });
}