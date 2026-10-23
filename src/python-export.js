// ZIP's stored format keeps this small, local export dependency-free.
// Both files are UTF-8 and placed directly at the root of the archive.
const encoder=new TextEncoder();
function crc32(bytes) {
 let crc=0xffffffff;
 for(const byte of bytes) {
  crc^=byte;
  for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
 }
 return (crc^0xffffffff)>>>0;
}
export function pythonArchive(code,library) {
 const chunks=[],directory=[];let offset=0,directorySize=0;
 for(const [name,text] of [['code.py',code],['bob_code.py',library]]) {
  const filename=encoder.encode(name),data=encoder.encode(text),crc=crc32(data);
  const header=new Uint8Array(30+filename.length),local=new DataView(header.buffer);
  local.setUint32(0,0x04034b50,true);local.setUint16(4,20,true);local.setUint16(6,0x800,true);
  local.setUint16(12,33,true); // DOS date: 1980-01-01 (stable archive metadata).
  local.setUint32(14,crc,true);local.setUint32(18,data.length,true);local.setUint32(22,data.length,true);
  local.setUint16(26,filename.length,true);header.set(filename,30);
  const entry=new Uint8Array(46+filename.length),central=new DataView(entry.buffer);
  central.setUint32(0,0x02014b50,true);central.setUint16(4,20,true);central.setUint16(6,20,true);
  central.setUint16(8,0x800,true);central.setUint16(14,33,true);central.setUint32(16,crc,true);
  central.setUint32(20,data.length,true);central.setUint32(24,data.length,true);
  central.setUint16(28,filename.length,true);central.setUint32(42,offset,true);entry.set(filename,46);
  chunks.push(header,data);directory.push(entry);directorySize+=entry.length;offset+=header.length+data.length;
 }
 const end=new Uint8Array(22),view=new DataView(end.buffer);
 view.setUint32(0,0x06054b50,true);view.setUint16(8,2,true);view.setUint16(10,2,true);
 view.setUint32(12,directorySize,true);view.setUint32(16,offset,true);
 const result=new Uint8Array(offset+directorySize+end.length);let cursor=0;
 for(const chunk of [...chunks,...directory,end]){result.set(chunk,cursor);cursor+=chunk.length;}
 return result;
}
