import Transaction from '../models/Transaction';
import { getCustomRepository, getRepository } from 'typeorm';
import TransactionRepository from '../repositories/TransactionsRepository';

import Category from '../models/Category';
import AppError from '../errors/AppError';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({ title, value, type, category }: Request): Promise<Transaction> {
  
    const transactionsRepository = getCustomRepository(TransactionRepository);
    const categoriesRepository = getRepository(Category);

    const { total } = await transactionsRepository.getBalance();

    if(type === 'outcome' && value > total) {
      throw new AppError('You do not have enough balance', 400);
    }

    let categorySearched = await categoriesRepository.findOne({ where: { title: category } });

    if(!categorySearched) {

      categorySearched = categoriesRepository.create({ title: category });

      await categoriesRepository.save(categorySearched);
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category: categorySearched
    });

    await transactionsRepository.save(transaction);
  
    return transaction;
  }
}

export default CreateTransactionService;
