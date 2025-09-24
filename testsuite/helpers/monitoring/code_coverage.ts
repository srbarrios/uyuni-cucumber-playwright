// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import * as fs from 'fs/promises';
import { parseString } from 'xml2js';
import { KeyValueStore } from '../core/keyvalue_store';
import { getTarget } from '../system/remote_nodes_env';

/**
 * CodeCoverage handler to produce, parse and report Code Coverage from the Java Server to our GitHub PRs
 */
export class CodeCoverage {
  private keyValueStore: KeyValueStore;

  /**
   * Initialize the CodeCoverage handler
   */
  constructor() {
    this.keyValueStore = new KeyValueStore(
      process.env.REDIS_HOST || 'localhost',
      parseInt(process.env.REDIS_PORT || '6379'),
      process.env.REDIS_USERNAME || 'admin',
      process.env.REDIS_PASSWORD || 'admin'
    );
  }

  /**
   * Parse a JaCoCo XML report, extracting information that will be included in a Set on a Redis database
   *
   * @param featureName - The name of the feature
   */
  async pushFeatureCoverage(featureName: string): Promise<void> {
    console.log(`Pushing coverage for ${featureName} into Redis`);
    const filename = `/tmp/jacoco-${featureName}.xml`;
    
    try {
      const xmlContent = await fs.readFile(filename, 'utf8');
      
      // Parse XML using xml2js
      await new Promise<void>((resolve, reject) => {
        parseString(xmlContent, { explicitArray: false }, async (err: any, result: { report: { package: any; }; }) => {
          if (err) {
            reject(err);
            return;
          }

          try {
            const packages = Array.isArray(result?.report?.package) 
              ? result.report.package 
              : [result?.report?.package].filter(Boolean);

            for (const pkg of packages) {
              if (!pkg) continue;
              
              const packageName = pkg.$.name;
              const sourceFiles = Array.isArray(pkg.sourcefile) 
                ? pkg.sourcefile 
                : [pkg.sourcefile].filter(Boolean);

              for (const sourcefile of sourceFiles) {
                if (!sourcefile) continue;
                
                const sourcefileName = sourcefile.$.name;
                const counterClass = Array.isArray(sourcefile.counter)
                  ? sourcefile.counter.find((c: any) => c.$.type === 'CLASS')
                  : sourcefile.counter?.$.type === 'CLASS' ? sourcefile.counter : null;

                if (!counterClass || !counterClass.$.covered) {
                  continue;
                }

                const coveredCount = parseInt(counterClass.$.covered, 10);
                if (coveredCount > 0) {
                  await this.keyValueStore.add(`${packageName}/${sourcefileName}`, featureName);
                }
              }
            }
            resolve();
          } catch (parseError) {
            reject(parseError);
          }
        });
      });
    } catch (error) {
      console.error('Error processing coverage:', error);
    } finally {
      try {
        await fs.unlink(filename);
      } catch (unlinkError) {
        console.warn('Could not delete temporary file:', unlinkError);
      }
    }
  }

  /**
   * Generate a JaCoCo report naming it as the feature name passed by parameter
   * (https://redis.io/docs/data-types/sets/)
   *
   * @param featureName - The name of the feature
   * @param html - Whether to generate an HTML report (default: false)
   * @param xml - Whether to generate an XML report (default: true)
   * @param source - Whether to include source files in the report (default: false)
   */
  async jacocoDump(featureName: string, html: boolean = false, xml: boolean = true, source: boolean = false): Promise<void> {
    const cli = 'java -jar /tmp/jacococli.jar';
    const htmlReport = html ? `--html /srv/www/htdocs/pub/jacoco-${featureName}` : '';
    const xmlReport = xml ? `--xml /srv/www/htdocs/pub/jacoco-${featureName}.xml` : '';
    const sourceFiles = source ? '--sourcefiles /tmp/uyuni-master/java/code/src' : '';
    const classFiles = '--classfiles /srv/tomcat/webapps/rhn/WEB-INF/lib/rhn.jar';
    const dumpPath = `/var/cache/jacoco-${featureName}.exec`;

    const server = await getTarget('server');
    
    // Dump coverage data
    await server.run(`${cli} dump --address localhost --destfile ${dumpPath} --port 6300 --reset`, { verbose: true });
    
    // Generate report
    const reportCommand = [cli, 'report', dumpPath, htmlReport, xmlReport, sourceFiles, classFiles]
      .filter(part => part.length > 0)
      .join(' ');
    await server.run(reportCommand, { verbose: true });
    
    // Extract XML file
    await server.extract(`/srv/www/htdocs/pub/jacoco-${featureName}.xml`, `/tmp/jacoco-${featureName}.xml`);
  }
}