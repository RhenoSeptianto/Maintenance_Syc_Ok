import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  list() { return this.svc.findAll(); }

  @Post()
  create(@Body() dto: { username: string; password: string; role: string; name?: string }) { return this.svc.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: { username?: string; password?: string; role?: string; name?: string }) { return this.svc.update(Number(id), dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(Number(id)); }
}
