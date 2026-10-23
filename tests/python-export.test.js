import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pythonArchive} from '../src/python-export.js';
import {Blockly,generatePython} from '../src/blocks.js';

test('Python ZIP contains exactly the current script and bundled library, with valid CRCs and UTF-8',()=>{
 const w=new Blockly.Workspace();w.newBlock('head_goto');
 const code=generatePython(w,'bob.local')+'\n# BoB says hello 👋\n';w.dispose();
 const library=readFileSync('public/bob_code.py','utf8');
 const zip=pythonArchive(code,library);
 const check=spawnSync('python',['-c',`import ast,base64,io,json,sys,zipfile
data=json.loads(sys.stdin.buffer.read().decode('utf-8'))
with zipfile.ZipFile(io.BytesIO(base64.b64decode(data['zip']))) as archive:
    assert archive.namelist()==['code.py','bob_code.py']
    assert archive.testzip() is None
    assert archive.read('code.py').decode('utf-8')==data['code']
    assert archive.read('bob_code.py').decode('utf-8')==data['library']
    for name in archive.namelist(): ast.parse(archive.read(name).decode('utf-8'))
`],{input:JSON.stringify({zip:Buffer.from(zip).toString('base64'),code,library}),encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
});

