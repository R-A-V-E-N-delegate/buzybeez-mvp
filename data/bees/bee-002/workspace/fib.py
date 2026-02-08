def fibonacci(n):
    """Calculate the first n fibonacci numbers"""
    fib_list = []
    a, b = 0, 1
    for _ in range(n):
        fib_list.append(a)
        a, b = b, a + b
    return fib_list

# Calculate and print the first 10 fibonacci numbers
fib_numbers = fibonacci(10)
print("First 10 Fibonacci numbers:")
print(fib_numbers)
