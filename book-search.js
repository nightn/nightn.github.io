var book;

console.log(`书本总数: ${database.length}`);

function search() {
  if (book == null) {
    console.log('请定义 book 变量，然后执行 search()');
  }
  let outLines = ['书名\t是否规划\t原始编号\t第一主编\t出版单位'];
  const bookList = book.split('\n').map(x => x.trim());
  if (bookList[bookList.length - 1].length === 0) {
    bookList.pop();
  }
  bookList.forEach(x => {
    let found = false;
    let item;
    for (let key in database) {
      item = database[key];
      found = item['书名'] === x;
      if (found) {
        break;
      }
    }

    let ln ;
    if (!found) {
      ln = `${x}\t否`;
    } else {
      ln = `${x}\t${item['来源']}\t${item['编号']}\t${item['第一主编']}\t${item['出版单位']}`;
    }
    outLines.push(ln);
  });
  console.log(outLines.join('\n'));
}
