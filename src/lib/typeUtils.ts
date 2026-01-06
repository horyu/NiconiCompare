/**
 * 型レベルのユーティリティ型
 */

/**
 * 2つの型が完全に等しいかどうかをチェックする
 *
 * @example
 * type Test1 = Equals<string, string> // true
 * type Test2 = Equals<string, number> // false
 * type Test3 = Equals<'a' | 'b', 'b' | 'a'> // true (union の順序は無関係)
 */
export type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false

/**
 * 型が true であることをアサートする
 * コンパイル時の型チェックに使用
 *
 * @example
 * type MyCheck = Assert<Equals<'a', 'a'>> // OK
 * type MyCheck = Assert<Equals<'a', 'b'>> // Error: Type 'false' does not satisfy the constraint 'true'
 */
export type Assert<T extends true> = T
