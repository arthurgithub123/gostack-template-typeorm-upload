import { getRepository, In, getCustomRepository } from 'typeorm';

import csvParse from 'csv-parse';
import fs from 'fs';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface RequestCSV {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    
    const postedFileReadStream = fs.createReadStream(filePath);
    const parseStream = csvParse({ from_line: 2 });
    const parseCSV = postedFileReadStream.pipe(parseStream);

    const transactions: RequestCSV[] = [];
    const categories: string[] = [];

    const categoriesRepository = getRepository(Category);
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    parseCSV.on('data', async line => {

      const [title, type, value, category] = line.map((cell: string) => cell.trim());

      if(!title || !type || !value)
        return;

      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const existentCategories = await categoriesRepository.find({ where: In(categories) });
    const existentCategoriesTitles = existentCategories.map((category: Category) => category.title);

    const notExistentCategoriesTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      notExistentCategoriesTitles.map(title => ({ title }) )
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories];

    const createdTransactions = transactionsRepository.create(
      transactions.map(
        transaction => (
          {
            title: transaction.title,
            type: transaction.type,
            value: transaction.value,
            category: finalCategories.find(category => category.title === transaction.category)
          }
        )
      )
    );
    
    await transactionsRepository.save(createdTransactions);

    await fs.promises.unlink(filePath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
