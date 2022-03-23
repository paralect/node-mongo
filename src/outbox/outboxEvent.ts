type OutboxEvent = {
  _id: string;
  type: 'create' | 'update' | 'remove';
  data: any;
  diff?: any[];
  createdOn: Date;
};

export default OutboxEvent;
