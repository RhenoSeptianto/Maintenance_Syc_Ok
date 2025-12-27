import { Body, Controller, Get, Param, Post, Put, Res, NotFoundException } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import type { Response } from 'express';
import PDFDocument = require('pdfkit');
import Jimp from 'jimp';
import * as fs from 'fs';
import * as path from 'path';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';

@Controller('maintenances')
export class MaintenanceController {
  constructor(private readonly svc: MaintenanceService) {}

  @Post()
  create(@Body() dto: CreateMaintenanceDto) {
    // accept: title, details, date (string), storeId?, submittedBy?, scheduleId?
    const payload: any = { ...dto, date: new Date(dto.date) };
    if (payload.scheduleId != null) {
      const n = Number(payload.scheduleId);
      payload.scheduleId = Number.isFinite(n) ? n : null;
    }
    return this.svc.create(payload);
  }

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const idNum = Number(id);
    if (!Number.isFinite(idNum)) throw new NotFoundException('Invalid id');
    return this.svc.findOne(idNum);
  }

  @Put(':id/approve')
  @Roles('admin')
  approve(@Param('id') id: string, @Body() body: { approvedBy?: string }) {
    const idNum = Number(id);
    if (!Number.isFinite(idNum)) throw new NotFoundException('Invalid id');
    return this.svc.updateStatus(idNum, 'approved', body?.approvedBy);
  }

  @Put(':id/reject')
  @Roles('admin')
  reject(@Param('id') id: string, @Body() body: { approvedBy?: string }) {
    const idNum = Number(id);
    if (!Number.isFinite(idNum)) throw new NotFoundException('Invalid id');
    return this.svc.updateStatus(idNum, 'rejected', body?.approvedBy);
  }

  @Get(':id/pdf')
  // PDF tetap perlu auth; jangan ditandai public.
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const idNum = Number(id);
    if (!Number.isFinite(idNum)) throw new NotFoundException('Invalid id');
    const data = await this.svc.findOne(idNum);
    if (!data) throw new NotFoundException('Maintenance not found');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=maintenance-${id}.pdf`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);
    const shouldWatermark = (()=>{
      const s = String((data as any).status || '').toLowerCase();
      return ['approved','complete','completed','complate'].includes(s);
    })();
    const drawWatermark = () => {
      if (!shouldWatermark) return;
      try{
        const text = 'MAINTENANCE SELESAI';
        const { width, height } = doc.page;
        doc.save();
        doc.fillColor('#e2e8f0').opacity(0.18);
        doc.font('Helvetica-Bold').fontSize(50);
        doc.translate(width/2, height/2);
        doc.rotate(-25);
        const tw = doc.widthOfString(text);
        doc.text(text, -tw/2, -20, { align:'center' });
        doc.restore();
        doc.opacity(1).fillColor('black');
      }catch{}
    };
    doc.on('pageAdded', drawWatermark);
    // Try to render logo on the header (optional). Sources priority:
    // 1) LOGO_PATH filesystem
    // 2) LOGO_URL remote url
    // 3) Fallbacks: http://frontend:3002/logo.png, http://localhost:3012/logo.png
    async function loadLogoBuffer(): Promise<Buffer|null> {
      try {
        const p = process.env.LOGO_PATH;
        if (p) {
          const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
          if (fs.existsSync(abs)) return fs.readFileSync(abs);
        }
      } catch {}
      // Restrict remote fetch to allowed hosts only (prevent SSRF)
      const allowList = (process.env.LOGO_URL_WHITELIST || 'http://frontend:3002,http://localhost:3012,http://127.0.0.1:3012')
        .split(',').map(s => s.trim()).filter(Boolean);
      const isAllowed = (u: string) => allowList.some(prefix => u.startsWith(prefix));
      const urlCandidates = [process.env.LOGO_URL, 'http://frontend:3002/logo.png', 'http://localhost:3012/logo.png']
        .filter((x): x is string => !!x && isAllowed(x));
      for (const u of urlCandidates) {
        try {
          const ac = new AbortController();
          const t = setTimeout(() => ac.abort(), 2500);
          // Use global fetch (Node 18+). Cast to any to avoid TS lib dependency.
          const resp = await (fetch as any)(u, { signal: ac.signal });
          clearTimeout(t);
          if (resp && resp.ok) {
            const ab = await resp.arrayBuffer();
            return Buffer.from(new Uint8Array(ab));
          }
        } catch {}
      }
      return null;
    }

    const storeName = (data as any).storeName ?? '-';
    const maintenanceDate = new Date(data.date);
    const maintenanceDateStr = maintenanceDate.toLocaleDateString();
    const technicianName = (data as any).technician ?? '-';
    const headerMarginLeft = (doc.page.margins?.left ?? 40);
    const headerMarginTop = (doc.page.margins?.top ?? 40);
    let cursorY = headerMarginTop;

    try {
      const logo = await loadLogoBuffer();
      if (logo) {
        drawWatermark();
        const topY = headerMarginTop;
        const leftX = headerMarginLeft;
        doc.image(logo, leftX, topY, { fit: [70, 70] });
        // Title to the right of the logo
        const titleX = leftX + 80;
        doc.fontSize(16).text('FORM MAINTENANCE STORE', titleX, topY + 20, { align: 'left' });
        // Setelah header (logo + title), set cursor di bawahnya
        cursorY = topY + 90;
      } else {
        doc.fontSize(16).text('FORM MAINTENANCE STORE', { align: 'center' });
        cursorY = doc.y + 10;
      }
    } catch {
      doc.fontSize(16).text('FORM MAINTENANCE STORE', { align: 'center' });
      cursorY = doc.y + 10;
    }
    drawWatermark();
    // Posisikan cursor teks di bawah header lalu tulis meta info rapi, rata kiri
    doc.fontSize(11);
    doc.y = cursorY;
    doc.x = headerMarginLeft;
    doc.text(`Store   : ${storeName}`);
    doc.text(`Tanggal : ${maintenanceDateStr}`);
    doc.text(`TS      : ${technicianName}`);
    doc.text(`Status  : ${data.status}`);
    doc.moveDown();

    let items: any[] = [];
    let signature: any;
    try {
      const jd = JSON.parse((data as any).details);
      items = jd?.items || [];
      signature = jd?.signature;
    } catch {}
    // Fallback parsing untuk data lama (details berupa teks bebas)
    if ((!items || items.length === 0) && typeof (data as any).details === 'string'){
      const raw = String((data as any).details || '');
      const lines = raw.replace(/\r/g,'').split('\n').map(s=>s.trim());
      const out: any[] = [];
      let cur: any = null;
      let no = 0;
      const itemRe = /^(\d+)\.\s*\[(.*?)\]\s*(.*?)\s*\|\s*SN\s*:?(.*?)\|\s*Kondisi\s*:?(.*)$/i;
      for (const ln of lines){
        if (!ln) continue;
        const m = ln.match(itemRe);
        if (m){
          cur = {
            no: Number(m[1])||(++no),
            lokasi: (m[2]||'').trim(),
            hardware: (m[3]||'').trim(),
            sn: (m[4]||'').replace(/^\s*:?\s*/,'').trim(),
            kondisi: (m[5]||'').trim().toLowerCase().includes('tidak') ? 'tidak' : ((m[5]||'').trim().toLowerCase().includes('baik') ? 'baik' : ''),
            panduan: '',
            keterangan: '',
          };
          out.push(cur);
          continue;
        }
        const p = ln.match(/^Panduan:\s*(.*)$/i);
        if (p && cur){ cur.panduan = (p[1]||'').trim(); continue; }
        if (cur && !/^\d+\./.test(ln)){
          cur.panduan = (cur.panduan ? cur.panduan + ' ' : '') + ln;
        }
      }
      items = out;
    }
    // Tabel detail pekerjaan
    doc.text('Detail Pekerjaan:', { continued: false });
    doc.moveDown(0.3);

    // Gunakan margin aktual dari dokumen agar presisi lebar tabel = area konten
    const marginLeft = (doc.page.margins?.left ?? 40);
    const marginRight = (doc.page.margins?.right ?? 40);
    const pageWidth = doc.page.width;
    const usable = pageWidth - marginLeft - marginRight;
    // Set lebar dasar + penyesuaian agar total persis = usable
    const col = {
      no: 24,
      lokasi: 52,
      hardware: 52,
      sn: 82,
      kondisi: 42,
      usia: 64,
      history: 82,
      ket: 58,
    } as any;
    const fixedNoPanduan = col.no + col.lokasi + col.hardware + col.sn + col.kondisi + col.usia + col.history + col.ket;
    col.panduan = Math.max(100, Math.floor(usable - fixedNoPanduan));
    // Pastikan kolom terakhir pas ke kanan halaman
    const sumFirstCols = col.no + col.lokasi + col.hardware + col.sn + col.panduan + col.kondisi + col.usia + col.history;
    col.ket = Math.max(50, Math.floor(usable - sumFirstCols));

    // Samakan dengan header pada form tabel (Merk & SN)
    const headers = ['No','Lokasi','Hardware','Merk & SN','Panduan','Kondisi','Usia','History','Keterangan'];
    let widths = [col.no, col.lokasi, col.hardware, col.sn, col.panduan, col.kondisi, col.usia, col.history, col.ket].map(n=>Math.floor(n));
    // Pastikan header tidak terpotong: sesuaikan minimal lebar per judul (ukur dengan font header)
    const headerFontSize = 10;
    const padXHeader = 6;
    doc.font('Helvetica-Bold').fontSize(headerFontSize);
    const minWidths = headers.map(h => Math.ceil(doc.widthOfString(h, { width: 1000 }) + padXHeader*2));
    let need = 0;
    for (let i=0;i<widths.length;i++){
      if (widths[i] < minWidths[i]){ const d = minWidths[i]-widths[i]; widths[i]+=d; need+=d; }
    }
    if (need>0){
      // kurangi dari kolom Panduan terlebih dulu, lalu SN, lalu Lokasi
      const reduce = (idx:number, min:number)=>{ const can = Math.max(0, widths[idx]-min); const take = Math.min(need, can); widths[idx]-=take; need-=take; };
      reduce(4, Math.max(100, minWidths[4]));
      if (need>0) reduce(3, Math.max(80, minWidths[3]));
      if (need>0) reduce(1, Math.max(46, minWidths[1]));
      if (need>0) reduce(2, Math.max(46, minWidths[2]));
      if (need>0) reduce(7, Math.max(70, minWidths[7]));
      if (need>0) reduce(6, Math.max(54, minWidths[6]));
      if (need>0) reduce(8, Math.max(50, minWidths[8]));
      if (need>0) reduce(0, Math.max(24, minWidths[0]));
    }
    // Normalisasi total ke usable persis
    let sum = widths.reduce((a,b)=>a+b,0);
    if (sum > usable){
      // kurangi kelebihan dari Panduan
      const over = sum - usable;
      widths[4] = Math.max(minWidths[4], widths[4] - over);
    } else if (sum < usable){
      widths[4] += (usable - sum);
    }
    const startX = marginLeft;
    let y = doc.y;

    function drawRow(values: string[], isHeader=false, rowIndex=0){
      // hitung tinggi baris dari konten tiap kolom
      const padX = 6, padY = 4;
      let h = 20;
      for(let i=0;i<values.length;i++){
        const w = widths[i] - padX*2;
        const txt = values[i] || '';
        // gunakan font lebih kecil untuk kolom berteks panjang agar tidak terlalu tinggi
        const isSmall = i === 4 || i === 6 || i === 7 || i === 8;
        doc.font(isHeader? 'Helvetica-Bold' : 'Helvetica').fontSize(isHeader? headerFontSize : (isSmall? 9 : 10));
        const ht = isHeader
          ? (doc.heightOfString(String(txt), { width: w, lineBreak: false }) + padY*2)
          : (doc.heightOfString(String(txt), { width: w, align: 'left' }) + padY*2);
        if (ht > h) h = ht;
      }
      const bottom = doc.page.height - 60; // footer margin
      if (y + h > bottom){
        doc.addPage();
        // redraw header on new page
        y = 40;
        drawRow(headers, true);
      }
      let x = startX;
      // Zebra stripes untuk keterbacaan
      if (!isHeader && rowIndex % 2 === 1){
        doc.save().rect(x, y, widths.reduce((a,b)=>a+b,0), h).fill('#f8fafc').restore();
      }
      for(let i=0;i<values.length;i++){
        // Pastikan tidak menembus margin kanan
        const rightEdge = marginLeft + usable;
        let w = widths[i];
        if (x + w > rightEdge) w = Math.max(10, Math.floor(rightEdge - x));
        // cell border
        doc.lineWidth(0.6).strokeColor('#94a3b8');
        doc.rect(x, y, w, h).stroke();
        // header shading
        if (isHeader){
          doc.save().rect(x, y, w, h).fill('#e2e8f0').restore();
          doc.fill('#0f172a').font('Helvetica-Bold').fontSize(headerFontSize);
        } else {
          const isSmall = i===4 || i===6 || i===7 || i===8;
          doc.fill('#0f172a').font('Helvetica').fontSize(isSmall?9:10);
        }
        const txt = values[i] || '';
        const align = isHeader? 'center' : ((i===0 || i===5 || i===6) ? 'center' : 'left');
        if (isHeader){
          const tH = doc.heightOfString(String(txt), { width: w - padX*2, lineBreak: false });
          const yCentered = y + (h - tH) / 2; // vertikal tengah
          doc.text(String(txt), x + padX, yCentered, { width: w - padX*2, align, lineBreak: false });
        } else {
          doc.text(String(txt), x + padX, y + padY, { width: w - padX*2, align });
        }
        x += w;
      }
      y += h;
      doc.moveTo(startX, y);
    }

    // header row
    drawRow(headers, true);
    // body rows
    let ri = 0;
    for (const it of items){
      const kondisiLabel = ((): string => {
        const v = String(it.kondisi || '').toLowerCase().trim();
        if (v === 'baik') return 'Baik';
        if (v === 'tidak' || v === 'tidak baik' || v === 'buruk') return 'Tidak Baik';
        return v || '';
      })();
      const fmtDate = (val: any) => {
        try {
          const d = val ? new Date(val) : null;
          if (!d || Number.isNaN(d.getTime())) return '';
          return d.toLocaleDateString();
        } catch { return ''; }
      };
      const fmtUsia = (val: any) => {
        const n = Number(val);
        if (!Number.isFinite(n)) return '';
        const years = Math.floor(n / 12);
        const months = Math.floor(n % 12);
        if (years && months) return `${years} th ${months} bln`;
        if (years) return `${years} th`;
        return `${months} bln`;
      };
      const usiaText = [fmtUsia((it as any).usia), fmtDate((it as any).purchaseDate) ? `Tgl Beli: ${fmtDate((it as any).purchaseDate)}` : '']
        .filter(Boolean).join('\n');
      const historyText = [fmtDate((it as any).repairDate) ? `Tgl Perbaikan: ${fmtDate((it as any).repairDate)}` : '', (it as any).repairNote ? `Catatan: ${(it as any).repairNote}` : '']
        .filter(Boolean).join('\n');
      drawRow([
        String(it.no||''),
        String(it.lokasi||''),
        String(it.hardware||''),
        String(it.sn||''),
        String(it.panduan||''),
        kondisiLabel,
        usiaText,
        historyText,
        String(it.keterangan||''),
      ], false, ri++);
    }

    // Tanda tangan (dua kolom)
    doc.moveDown();
    const sig = (()=>{ try{ return typeof signature==='string' ? { ts: signature } : (signature as any) }catch{ return {} as any }})();
    const sigY = y + 16;
    const colW = (usable/2) - 10;
    const leftX = startX, rightX = startX + colW + 20;
    doc.font('Helvetica-Bold').text('Tanda Tangan TS Store', leftX, sigY);
    doc.font('Helvetica-Bold').text('Tanda Tangan Store', rightX, sigY);
    const boxH = 90;
    doc.rect(leftX, sigY+14, colW, boxH).stroke('#cbd5e1');
    doc.rect(rightX, sigY+14, colW, boxH).stroke('#cbd5e1');
    async function toPrintablePng(buf: Buffer, mime: string | null): Promise<Buffer> {
      try {
        const img = await Jimp.read(buf);
        // Create white background canvas
        const bg = new Jimp(img.bitmap.width, img.bitmap.height, 0xffffffff);
        bg.composite(img, 0, 0);
        // If source looked like JPEG (lost transparency), try whitening pure black pixels
        if (mime && /jpe?g/i.test(mime)) {
          bg.scan(0, 0, bg.bitmap.width, bg.bitmap.height, function (_x, _y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            // Turn near-pure black background to white, keep darker strokes (> ~20)
            if (r < 10 && g < 10 && b < 10) {
              this.bitmap.data[idx + 0] = 255;
              this.bitmap.data[idx + 1] = 255;
              this.bitmap.data[idx + 2] = 255;
              this.bitmap.data[idx + 3] = 255;
            }
          });
        }
        return await bg.getBufferAsync(Jimp.MIME_PNG);
      } catch {
        return buf; // fallback: use original
      }
    }

    async function drawSig(imgData: string|undefined, x:number){
      if (imgData && typeof imgData==='string' && imgData.startsWith('data:image')){
        try{
          const base64 = imgData.split(',')[1];
          const buf = Buffer.from(base64,'base64');
          const mime = imgData.substring(5, imgData.indexOf(';')) || null; // e.g., image/png
          const fixed = await toPrintablePng(buf, mime);
          doc.image(fixed, x+10, sigY+20, { fit:[colW-20, boxH-20], align:'center', valign:'center' });
        }catch{}
      }
    }
    await drawSig(sig?.ts, leftX);
    await drawSig(sig?.store, rightX);
    doc.font('Helvetica').text(`Nama: ${sig?.tsName||'-'}`, leftX, sigY+boxH+18, { width: colW });
    doc.text(`Nama: ${sig?.storeName||'-'}`, rightX, sigY+boxH+18, { width: colW });
    doc.end();
  }

  // Update konten maintenance (dipakai untuk perbaikan/edits ringan)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateMaintenanceDto) {
    const idNum = Number(id);
    if (!Number.isFinite(idNum)) throw new NotFoundException('Invalid id');
    return this.svc.updateContent(idNum, body);
  }
}
