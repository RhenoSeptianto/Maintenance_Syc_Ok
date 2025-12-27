import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column()
  username: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ select: false })
  password: string; // bcrypt hash

  @Column()
  role: string; // 'admin' | 'user'
}
