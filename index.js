const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const slugify = require('slugify');

const SOURCE_DIR = './plugins';
const BUCKET = 'https://app.imversed.com/flow-plugins';

fs.readdir(SOURCE_DIR, (err, files) => {
    if (err) {
        console.error(`Error reading directory: ${err}`);
        return;
    }

    const fileList = files.filter(file => {
        const filePath = path.join(SOURCE_DIR, file);
        return fs.statSync(filePath).isFile();
    });

    const promises = fileList.map(f => {
        return new Promise((resolve, reject) => {
            fs.readFile(path.join(SOURCE_DIR, f), 'utf8', (err, data) => {
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
                            plugin_meta.url = `${BUCKET}/${f}`;

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
            console.log(">>> json file: ", json);
            fs.writeFile('db.json', json, 'utf8', err => {
                if (err) {
                    console.log("Error occurred while saving db.json");
                } else {
                    console.log("db.json file ready");
                }
            });
        })
        .catch(err => {
            console.log("Error occurred while processing files:", err);
        });
});
