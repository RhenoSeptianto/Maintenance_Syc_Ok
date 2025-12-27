import { Controller, Get, Post, Put, Delete, Param, Body, Query, Req } from '@nestjs/common';
import { AssetService } from './asset.service';

@Controller('assets')
export class AssetController {
  constructor(private readonly svc: AssetService) {}

  @Get()
  list(@Query() q: any, @Req() req: any) {
    const user = req?.user || {};
    // Safety: untuk role TS/User, wajib pilih store agar query tidak berat
    const role = String(user.role || '').toLowerCase();
    const hasStore = q && q.storeId !== undefined && q.storeId !== null && String(q.storeId) !== '';
    if ((role === 'user' || role === 'ts') && !hasStore) {
      // Jangan load semua aset milik TS sekaligus dari UI; kembalikan kosong
      return [] as any;
    }
    return this.svc.list(q, { role: user.role, username: user.username });
  }

  @Get('counts')
  counts(@Query('storeIds') storeIds: string, @Req() req: any) {
    const ids = String(storeIds || '')
      .split(',')
      .map(s=>Number(s.trim()))
      .filter(n=>Number.isFinite(n))
    const user = req?.user || {}
    return this.svc.countByStore(ids, { role: user.role, username: user.username })
  }

  @Get(':id')
  get(@Param('id') id: string) { return this.svc.get(Number(id)); }

  @Post()
  create(@Body() body: any) { return this.svc.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.svc.update(Number(id), body); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(Number(id)); }

  // History endpoints (auth required; both admin and user allowed by default RolesGuard)
  @Get(':id/history')
  history(@Param('id') id: string) { return this.svc.listHistory(Number(id)); }

  @Post(':id/history')
  addHistory(@Param('id') id: string, @Body() body: any) {
    // Expect body: { date: 'YYYY-MM-DD', note: string }
    const date = String(body?.date || '').slice(0,10);
    const note = String(body?.note || '').slice(0,2000);
    const createdBy = (body?.createdBy ? String(body.createdBy) : null);
    return this.svc.addHistory(Number(id), { date, note, createdBy });
  }

  @Put(':id/history/:hid')
  updateHistory(@Param('id') id: string, @Param('hid') hid: string, @Body() body: any) {
    return this.svc.updateHistory(Number(id), Number(hid), { date: body?.date, note: body?.note });
  }

  @Delete(':id/history/:hid')
  removeHistory(@Param('id') id: string, @Param('hid') hid: string) {
    return this.svc.removeHistory(Number(id), Number(hid));
  }
}
