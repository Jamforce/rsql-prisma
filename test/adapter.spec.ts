import { rsqlStringToQuery } from '../src';

describe('adapt', () => {
  const sut = (expression: string) =>
    rsqlStringToQuery<{ name: string }>(expression);
  /**/
  it('should be create equals compare', () => {
    expect(sut('name==John')).toMatchObject({
      name: { equals: 'John' },
    });
  });

  it('should be create more than compare', () => {
    expect(sut('age>18')).toMatchObject({
      age: { gt: 18 },
    });
  });

  it('should be create more than equal compare', () => {
    expect(sut('age>=18')).toMatchObject({
      age: { gte: 18 },
    });
    expect(sut('createdAt>=1970-01-01T15:00:00.000Z')).toMatchObject({
      createdAt: { gte: new Date('1970-01-01T15:00:00.000Z') },
    });
  });

  it('should be create less than compare', () => {
    expect(sut('age<18')).toMatchObject({
      age: { lt: 18 },
    });
  });

  it('should be create less than or equal compare', () => {
    expect(sut('age<=18')).toMatchObject({
      age: { lte: 18 },
    });
  });

  it('should create not equal comparison', () => {
    expect(sut('age!=18')).toMatchObject({
      age: { not: 18 },
    });
  });

  it('should create not like comparison', () => {
    expect(sut('age!=*18*')).toMatchObject({
      NOT: {
        age: { contains: 18 },
      },
    });
  });

  it('should be in compare', () => {
    expect(sut('name=in=(John,Doe)')).toMatchObject({
      name: { in: ['John', 'Doe'] },
    });
  });

  it('should be not in compare', () => {
    expect(sut('name=out=(John,Doe)')).toMatchObject({
      name: { notIn: ['John', 'Doe'] },
    });
  });

  it('should be like compare', () => {
    expect(sut('name==*John')).toMatchObject({
      name: { startsWith: 'John' },
    });
    expect(sut('name==John*')).toMatchObject({
      name: { endsWith: 'John' },
    });
    expect(sut('name==*John*')).toMatchObject({
      name: { contains: 'John' },
    });
  });

  it('should be and compare', () => {
    expect(sut('name==John;age==18;id==2')).toMatchObject({
      AND: [
        {
          name: { equals: 'John' },
          age: { equals: 18 },
          id: { equals: 2 },
        },
      ],
    });
    expect(sut('name==John*;age<18')).toMatchObject({
      AND: [
        {
          name: { endsWith: 'John' },
          age: { lt: 18 },
        },
      ],
    });
  });

  it('should be or compare', () => {
    expect(sut('name==John,age==18,id==2')).toMatchObject({
      OR: [
        {
          name: { equals: 'John' },
          age: { equals: 18 },
          id: { equals: 2 },
        },
      ],
    });
    expect(sut('name==John*,age<18')).toMatchObject({
      OR: [
        {
          name: { endsWith: 'John' },
          age: { lt: 18 },
        },
      ],
    });
  });

  it('should be able to perform the operation AND inside operation OR', () => {
    expect(
      sut(
        'franchiseId==1;type==franchise_employee,franchiseId==1;type==franchise_owner'
      )
    ).toMatchObject({
      OR: [
        {
          AND: [
            {
              franchiseId: { equals: '1' },
              type: { equals: 'franchise_employee' },
            },
          ],
        },
        {
          AND: [
            {
              franchiseId: { equals: '1' },
              type: { equals: 'franchise_owner' },
            },
          ],
        },
      ],
    });
  });

  it('should be can filter relation items', () => {
    expect(sut('address.state==Italy;address.city==Naples')).toMatchObject({
      AND: [
        {
          address: {
            state: { equals: 'Italy' },
            city: { equals: 'Naples' },
          },
        },
      ],
    });
    expect(
      sut('price.amount>20;name==Pizza;price.currency==EUR')
    ).toMatchObject({
      AND: [
        {
          name: { equals: 'Pizza' },
          price: {
            amount: { gt: 20 },
            currency: { equals: 'EUR' },
          },
        },
      ],
    });
    expect(
      sut('roles.name==Admin;roles.permission.name==Create')
    ).toMatchObject({
      AND: [
        {
          roles: {
            name: { equals: 'Admin' },
            permission: {
              name: { equals: 'Create' },
            },
          },
        },
      ],
    });
  });

  it('should be able to perform the operation AND in the same field', () => {
    expect(sut('amount>0;amount<20')).toMatchObject({
      AND: [{ amount: { gt: 0, lt: 20 } }],
    });
  });

  it('should be able to perform the operation OR inside operation AND', () => {
    expect(
      sut(
        'age>18;(nome==John*;cognome==Travolta*,nome==Travolta*;cognome==John*)'
      )
    ).toMatchObject({
      AND: [
        {
          age: { gt: 18 },
          OR: [
            {
              AND: [
                {
                  cognome: { endsWith: 'Travolta' },
                  nome: { endsWith: 'John' },
                },
              ],
            },
            {
              AND: [
                {
                  cognome: { endsWith: 'John' },
                  nome: { endsWith: 'Travolta' },
                },
              ],
            },
          ],
        },
      ],
    });
  });
});
